"""AI-powered incident confidence and media verification service.

Uses Google Gemini Multimodal Vision to inspect uploaded incident images,
verify real-world traffic scene evidence against incident descriptions,
and calculate weighted credibility scores combining:
  1. AI Media Alignment (60%)
  2. Community Crowd-Verifications (25%)
  3. Reporter Reliability Score (15%)
"""
import base64
import json
import logging
import os
from typing import Dict, List, Optional, Tuple
from dotenv import load_dotenv
import requests

load_dotenv()
logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Candidate vision models with active free-tier quota in order of preference
CANDIDATE_VISION_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
]


def evaluate_media_alignment(description: str, media_urls: List[str]) -> Tuple[Optional[float], str]:
    """Download the reported incident photo and evaluate with Gemini Multimodal Vision.

    Returns:
        (score, assessment) where:
          - score: float in [0.0, 1.0] indicating visual alignment (0.0 for dummy/fake/unrelated),
                   or None if media could not be fetched or analyzed.
          - assessment: concise summary of the visual evidence.
    """
    if not media_urls or not GEMINI_API_KEY:
        return None, "No media attached or AI evaluation unconfigured"

    image_url = media_urls[0]

    # 1. Fetch image binary from URL with retry resilience
    resp = None
    for attempt in range(2):
        try:
            resp = requests.get(
                image_url,
                timeout=15,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ITS-Incident-Verifier/1.0"},
            )
            if resp.status_code == 200 and resp.content:
                break
        except Exception as fetch_err:
            logger.warning("Attempt %d error fetching media %s: %s", attempt + 1, image_url, fetch_err)

    if not resp or resp.status_code != 200 or not resp.content:
        return None, "Media could not be retrieved for automated assessment"

    try:
        b64_data = base64.b64encode(resp.content).decode("utf-8")
        mime_type = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
        if not mime_type.startswith("image/"):
            mime_type = "image/jpeg"
    except Exception as parse_err:
        logger.warning("Error parsing image payload %s: %s", image_url, parse_err)
        return None, "Media encoding failed"

    # 2. Build Multimodal Verification Prompt
    prompt = f"""You are an expert traffic AI incident verification system.
Analyze the provided photograph and assess whether it confirms the reported road incident.
Reported Incident: "{description}"

Evaluation Rules:
1. Is this a real-world photograph showing road/traffic/vehicle context?
   - Dummy graphics, icons, red squares, solid colors, transparent grids, memes, cartoons, selfies, and unrelated images MUST receive a score of 0.0.
2. If real vehicles/roads are shown, how strongly does the visual evidence substantiate the incident description (e.g. collision, wreckage, stalled car, hazard)?
   - 0.00 = completely unrelated, fake, or synthetic dummy image.
   - 0.10 - 0.40 = weakly related (e.g., normal car parked with no visible damage/incident).
   - 0.50 - 0.79 = plausible moderate evidence matching the report.
   - 0.80 - 1.00 = clear, undeniable visual evidence matching the description.

Respond strictly in JSON format with these exact keys:
{{"score": <decimal between 0.00 and 1.00>, "assessment": "<concise 1-sentence explanation of what is visually observed and whether it matches>"}}
"""

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": mime_type, "data": b64_data}},
                ]
            }
        ],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.1,
        },
    }

    # 3. Call Gemini REST endpoint with candidate models and timeout protection
    for model_name in CANDIDATE_VISION_MODELS:
        api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={GEMINI_API_KEY}"
        try:
            r = requests.post(api_url, json=payload, timeout=20)
            if r.status_code == 200:
                result = r.json()
                raw_text = result["candidates"][0]["content"]["parts"][0]["text"].strip()
                data = json.loads(raw_text)
                score = float(data.get("score", 0.0))
                score = max(0.0, min(1.0, score))
                assessment = data.get("assessment", "Assessment complete")
                return score, assessment
            else:
                logger.warning("Gemini vision model %s returned status %s: %s", model_name, r.status_code, r.text[:120])
        except Exception as e:
            logger.warning("Error calling Gemini model %s: %s", model_name, e)
            continue

    return None, "Automated assessment temporarily unavailable"


def get_media_alignment_score(description: str, media_urls: List[str]) -> Optional[float]:
    """Return media alignment score in [0.0, 1.0], or None on failure (backwards-compatible)."""
    score, _ = evaluate_media_alignment(description, media_urls)
    return score


def _base_verification_score(verif_list: List[Dict]) -> float:
    """Calculate base score from community confirmation/contradiction verdicts."""
    confirmations = sum(1 for v in verif_list if v.get("verdict") == "confirm")
    contradictions = sum(1 for v in verif_list if v.get("verdict") == "contradict")
    score = 50 + (confirmations * 5) - (contradictions * 8)
    return max(5, min(99, score))


def compute_total_confidence(
    description: str = "",
    media_urls: Optional[List[str]] = None,
    verif_list: Optional[List[Dict]] = None,
    user: Optional[Dict] = None,
    media_score: Optional[float] = None,
) -> int:
    """Compute weighted credibility confidence score (5 to 99).

    Weights:
      When media is analyzed:
        w1 (Media Alignment) = 60%
        w2 (Community Verifications) = 25%
        w3 (User Reliability) = 15%
      When no media is attached:
        w1 = 0%
        w2 = 62.5%
        w3 = 37.5%
    """
    verif_items = verif_list or []

    # If media_score wasn't pre-computed, evaluate on the fly if media_urls provided
    if media_score is None and media_urls and description:
        media_score = get_media_alignment_score(description, media_urls)

    verif_raw = _base_verification_score(verif_items)
    if media_score is None:
        return int(verif_raw)

    reliability = user.get("reliability_score", 3.0) if user else 3.0
    user_score = reliability / 5.0

    w1, w2, w3 = 0.60, 0.25, 0.15
    total = (w1 * (media_score * 100)) + (w2 * verif_raw) + (w3 * (user_score * 100))
    return int(max(5, min(99, round(total))))

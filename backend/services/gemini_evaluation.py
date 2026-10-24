import os
import json
import asyncio
import urllib.request
import base64

class GeminiEvaluationError(RuntimeError):
    """Raised when the Gemini API call fails or returns invalid data."""

async def evaluate_media_alignment(description: str, media_url: str) -> float:
    """Send description + a single media URL to Gemini and return a score (0.0‑1.0).

    Downloads the media (max 5 MiB, image/video only), calls the Gemini REST API
    , expects a JSON object like {"media_alignment_score": 0.85}
    in the model's text response, validates and returns the float.
    """
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise GeminiEvaluationError('GEMINI_API_KEY not configured')

    def download() -> bytes:
        with urllib.request.urlopen(media_url, timeout=10) as resp:
            ct = resp.getheader('Content-Type', '')
            if ct.startswith('image') or ct.startswith('video'):
                data = resp.read(5 * 1024 * 1024 + 1)
                if len(data) > 5 * 1024 * 1024:
                    raise GeminiEvaluationError('Media size exceeds 5 MiB limit')
                return data
            raise GeminiEvaluationError('Unsupported media Content-Type')

    media_bytes = await asyncio.to_thread(download)
    b64_content = base64.b64encode(media_bytes).decode('ascii')
    payload = {
        'contents': [
            {'role': 'user', 'parts': [{'text': description}]},
            {'role': 'user', 'parts': [{'inlineData': {'mimeType': 'image/jpeg', 'data': b64_content}}]},
        ],
        'generationConfig': {'responseMimeType': 'application/json'},
        'safetySettings': [],
    }
    endpoint = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}'
    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            resp_bytes = resp.read()
    except Exception as e:
        raise GeminiEvaluationError(str(e))
    try:
        resp_json = json.loads(resp_bytes)
        candidates = resp_json.get('candidates', [])
        if not candidates:
            raise GeminiEvaluationError('No candidates in response')
        text = candidates[0].get('content', {}).get('parts', [{}])[0].get('text', '')
        result = json.loads(text)
        score = float(result['media_alignment_score'])
    except Exception as e:
        raise GeminiEvaluationError(f'Invalid Gemini response: {e}')
    if not (0.0 <= score <= 1.0):
        raise GeminiEvaluationError('Score out of bounds')
    return score

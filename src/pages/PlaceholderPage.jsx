import './PlaceholderPage.css';

export default function PlaceholderPage({ title, description }) {
  return (
    <div className="placeholder-card">
      <div className="placeholder-icon" aria-hidden="true">🚧</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

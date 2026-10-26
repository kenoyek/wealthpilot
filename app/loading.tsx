export default function Loading() {
  return (
    <main className="loading-workspace" role="status" aria-live="polite">
      <span className="brand">◈ WealthPilot</span>
      <h1>Bringing your finances into focus…</h1>
      <div className="skeleton-row">
        {[0, 1, 2, 3].map((i) => (
          <div className="skeleton" key={i} />
        ))}
      </div>
      <p>Your workspace is loading.</p>
    </main>
  );
}

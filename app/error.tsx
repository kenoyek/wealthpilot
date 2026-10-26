"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth">
      <section className="panel">
        <h1>We couldn’t load your workspace.</h1>
        <p>
          Check your connection and local database, then try again. Your
          financial data has not been replaced with sample values.
        </p>
        <button onClick={reset}>Try again</button>
      </section>
    </main>
  );
}

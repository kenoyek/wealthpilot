"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth">
      <section className="panel">
        <h1>We couldn’t load your workspace.</h1>
        <p>
          Please check your connection and try again. Your saved records are
          safe; nothing has been replaced with example data.
        </p>
        <button onClick={reset}>Try again</button>
      </section>
    </main>
  );
}

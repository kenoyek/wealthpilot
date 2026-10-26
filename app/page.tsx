import Link from "next/link";
import {
  ArrowUpRight,
  Wallet,
  Target,
  ShieldCheck,
  ChartNoAxesCombined,
  Check,
} from "lucide-react";
import { privateRelease } from "@/lib/release-policy";
export default function Home() {
  return (
    <main className="landing">
      <nav className="landing-nav" aria-label="Website navigation">
        <Link className="brand" href="/">
          ◈ WealthPilot
        </Link>
        <div>
          <Link href="/login">Sign in</Link>
          <Link className="button" href="/login">
            {privateRelease() ? "Open your workspace" : "Create your account"}{" "}
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </nav>
      <section className="hero">
        <div>
          <p className="eyebrow">LESS GUESSWORK. MORE POSSIBILITY.</p>
          <h1>
            A clearer picture.
            <br />
            <em>A better financial future.</em>
          </h1>
          <p className="hero-copy">
            Bring your accounts, everyday spending and bigger ambitions
            together. Know where your money stands—and give every next step a
            purpose.
          </p>
          <div className="actions">
            <Link className="button" href="/login">
              Start your financial journey <ArrowUpRight size={18} />
            </Link>
            <a href="#features" className="button secondary">
              Explore WealthPilot
            </a>
          </div>
          <p className="hero-note">
            <ShieldCheck size={16} /> Your workspace is private to your account.
          </p>
        </div>
        <div className="hero-board">
          <div className="board-heading">
            <span className="dot" /> YOUR MONEY, WITH DIRECTION
          </div>
          <Wallet size={30} />
          <h2>Everything has a place.</h2>
          <p>From the everyday to the someday.</p>
          <div className="money-path">
            {[
              ["01", "Know your starting point", "Accounts & balances"],
              ["02", "See the everyday", "Income & spending"],
              ["03", "Make room for more", "Goals & cash planning"],
            ].map(([n, title, caption]) => (
              <div key={n}>
                <span>{n}</span>
                <div>
                  <b>{title}</b>
                  <small>{caption}</small>
                </div>
                <Check size={17} />
              </div>
            ))}
          </div>
          <div className="board-footer">
            Clarity today. Confidence for what’s next.
          </div>
        </div>
      </section>
      <section id="features" className="feature-section">
        <p className="eyebrow">BUILT AROUND YOUR REAL LIFE</p>
        <h2>Make money feel manageable.</h2>
        <div className="feature-grid">
          {[
            [
              Wallet,
              "Your accounts, together",
              "Track balances across personal and business accounts. Keep currencies separate and your numbers clear.",
            ],
            [
              ChartNoAxesCombined,
              "A story behind every number",
              "Understand received income, spending and cash movement with reconciled reports and CSV exports.",
            ],
            [
              Target,
              "Plans that respect your cash",
              "Reserve money for goals, keep track of bills and debts, and allocate income when it actually arrives.",
            ],
          ].map(([Icon, title, copy]) => {
            const I = Icon as typeof Wallet;
            return (
              <article className="panel" key={String(title)}>
                <I size={26} />
                <h3>{String(title)}</h3>
                <p>{String(copy)}</p>
              </article>
            );
          })}
        </div>
      </section>
      <section className="landing-cta">
        <div>
          <p className="eyebrow">START SMALL. BUILD SOMETHING LASTING.</p>
          <h2>Your next chapter starts with clarity.</h2>
          <p>
            Choose your currency, add an account, and take it one transaction at
            a time.
          </p>
        </div>
        <Link className="button" href="/login">
          Get started <ArrowUpRight size={17} />
        </Link>
      </section>
      <footer className="landing-footer">
        <span className="brand">◈ WealthPilot</span>
        <span>Personal finance. With perspective.</span>
        <Link href="/login">Your workspace →</Link>
      </footer>
    </main>
  );
}

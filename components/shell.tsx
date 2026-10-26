import Link from "next/link";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  ChartNoAxesCombined,
  SlidersHorizontal,
  PieChart,
  LogOut,
  Plus,
  Compass,
} from "lucide-react";
import { signout } from "@/app/actions";
const nav = [
  ["/dashboard", "Overview", LayoutDashboard],
  ["/transactions", "Transactions", ArrowLeftRight],
  ["/accounts", "Accounts", Wallet],
  ["/budgets", "Budgets", PieChart],
  ["/planning", "Planning", Compass],
  ["/reports", "Reports", ChartNoAxesCombined],
  ["/settings", "Settings", SlidersHorizontal],
] as const;
export default function Shell({
  children,
  active,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  active: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="workspace">
      <a className="skip" href="#content">
        Skip to content
      </a>
      <aside>
        <Link className="brand" href="/dashboard">
          <span>◈</span> WealthPilot
        </Link>
        <p className="nav-label">YOUR WORKSPACE</p>
        <nav aria-label="Main navigation">
          {nav.map(([url, label, Icon]) => (
            <Link
              prefetch={false}
              key={url}
              href={url}
              aria-current={active === url ? "page" : undefined}
              className={active === url ? "selected" : ""}
            >
              <Icon size={19} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="dot" /> A clearer financial future
          <p>Small steps. Lasting progress.</p>
        </div>
        <form action={signout} className="sidebar-signout">
          <button className="signout">
            <LogOut size={17} /> Sign out
          </button>
        </form>
      </aside>
      <div className="main">
        <header>
          <span className="breadcrumb">
            Workspace <span>/ {title}</span>
          </span>
          <Link href="/transactions#new" className="button" prefetch={false}>
            <Plus size={16} /> Add transaction
          </Link>
        </header>
        <main id="content">
          <div className="page-title">
            <div>
              <p className="eyebrow">YOUR FINANCES, IN FOCUS</p>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            <span className="live-tag">
              <span className="dot" /> Your private workspace
            </span>
          </div>
          {children}
        </main>
        <footer>
          WealthPilot{" "}
          <span>Your money. Your goals. Your financial future.</span>
        </footer>
      </div>
    </div>
  );
}
export function Notice({ error, notice }: { error?: string; notice?: string }) {
  return (
    <>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
    </>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">↗</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

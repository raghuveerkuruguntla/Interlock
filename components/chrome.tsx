"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSettings } from "./settings";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/#kill-chain", label: "Kill chain" },
  { href: "/demo", label: "Live demo" },
  { href: "/analyze", label: "Analyzer" },
  { href: "/evidence", label: "Evidence" },
];

export function Header() {
  const pathname = usePathname();
  const { largeType, setLargeType, theme, setTheme } = useSettings();

  return (
    <header className="site-header sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" aria-label="Interlock home" className="flex shrink-0 items-center gap-2.5 font-semibold tracking-tight text-ink">
          <span aria-hidden="true" className="brand-symbol">i<span className="brand-symbol-dot" /></span>
          <span className="text-lg tracking-[-0.055em]">interlock<span className="text-brand">.</span></span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : item.href.startsWith("/#") ? false : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
                className={`nav-link ${active ? "nav-link-active" : ""}`}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => setLargeType(!largeType)}
            aria-pressed={largeType} aria-label={largeType ? "Use standard text size" : "Use larger text"}
            title="Toggle larger text" className="header-icon-button">
            <span aria-hidden="true" className="text-xs font-semibold">Aa</span>
          </button>
          <button type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-pressed={theme === "dark"} aria-label="Toggle dark mode" title="Toggle light and dark mode"
            className="header-icon-button">
            <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
          </button>
          <Link href="/demo" className="header-cta hidden items-center gap-2 sm:inline-flex">Launch demo <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
      <nav aria-label="Mobile navigation" className="mobile-nav mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 pb-3 lg:hidden">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`nav-link shrink-0 ${active ? "nav-link-active" : ""}`}>{item.label}</Link>;
        })}
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-xl">
            <p className="text-lg font-semibold tracking-[-0.04em] text-ink">interlock<span className="text-brand">.</span></p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              A synthetic-data research prototype for the T-Mobile Scam &amp; Fraud Challenge.
              Not affiliated with or connected to live carrier systems. No real messages,
              calls, or account actions are intercepted or controlled.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-7 gap-y-3 text-sm text-muted">
            <Link href="/demo" className="hover:text-ink">Demo</Link>
            <Link href="/analyze" className="hover:text-ink">Analyzer</Link>
            <Link href="/network" className="hover:text-ink">Network</Link>
            <Link href="/evidence" className="hover:text-ink">Evidence</Link>
            <Link href="/limits" className="hover:text-ink">Limits</Link>
            <a href="https://github.com/raghuveerkuruguntla/Interlock" rel="noreferrer" className="hover:text-ink">GitHub ↗</a>
          </div>
        </div>
        <div className="mt-9 flex flex-wrap justify-between gap-3 border-t border-line pt-5 text-xs text-faint">
          <span>© 2026 Interlock · A research prototype</span>
          <span>Use fictional data only. Never enter real passwords or one-time codes.</span>
        </div>
      </div>
    </footer>
  );
}

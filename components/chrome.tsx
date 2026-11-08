"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSettings } from "./settings";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/#kill-chain", label: "Kill chain" },
  { href: "/demo", label: "Live demo" },
  { href: "/analyze", label: "Analyzer" },
];

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useSettings();

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


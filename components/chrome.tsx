"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "./account";
import { useSettings } from "./settings";

/** Sign in, or the signed-in customer's dashboard. */
function AccountLink() {
  const { account, loading } = useAccount();
  if (loading) return <span className="inline-block w-14" aria-hidden="true" />;
  return account ? (
    <Link href="/account" title={account.user.email} className="nav-link shrink-0">
      {account.user.name.split(" ")[0] || "Account"}
    </Link>
  ) : (
    <Link href="/signin" className="nav-link shrink-0">
      Sign in
    </Link>
  );
}

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/#kill-chain", label: "Kill chain" },
  { href: "/live", label: "Live call" },
  { href: "/demo", label: "Live demo" },
  { href: "/operator", label: "Incident console" },
  { href: "/analyze", label: "Analyzer" },
  { href: "/evidence", label: "Evidence" },
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

        <nav aria-label="Main navigation" className="hidden items-center gap-1 xl:flex">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : item.href.startsWith("/#") ? false : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
                className={`nav-link whitespace-nowrap ${active ? "nav-link-active" : ""}`}>
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
          <AccountLink />
          <Link href="/demo" className="header-cta hidden items-center gap-2 sm:inline-flex">Launch demo <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
      <nav aria-label="Mobile navigation" className="mobile-nav mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 pb-3 xl:hidden">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`nav-link shrink-0 ${active ? "nav-link-active" : ""}`}>{item.label}</Link>;
        })}
      </nav>
    </header>
  );
}


"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useAccount } from "./account";
import { useSettings } from "./settings";

/**
 * Whether this browser might have a signed-in Clerk session, read from
 * Clerk's own `__client_uat` cookie (named with a suffix on some setups). It
 * is "0" or absent when nobody is signed in. `null` means unknown — during
 * server rendering, before the browser has been asked.
 */
function readSessionHint(): boolean | null {
  if (typeof document === "undefined") return null;
  return document.cookie
    .split(";")
    .map((c) => c.trim())
    .some((c) => c.startsWith("__client_uat") && !/=0?$/.test(c));
}
const noSubscribe = () => () => {};

/**
 * Sign in, or the signed-in user's dashboard and Clerk account menu.
 *
 * A signed-out visitor sees Sign in straight away, without waiting for Clerk
 * to load. Someone who may be signed in sees a brief blank placeholder instead,
 * so "Sign in" never flashes for them; if that takes more than a few seconds
 * (Clerk cannot be reached), the Sign in link appears anyway.
 */
function AccountLink() {
  const { account, loading } = useAccount();
  const maybeSignedIn = useSyncExternalStore(noSubscribe, readSessionHint, () => null);
  const [waitedTooLong, setWaitedTooLong] = useState(false);
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setWaitedTooLong(true), 3000);
    return () => clearTimeout(timer);
  }, [loading]);
  if (loading && maybeSignedIn !== false && !waitedTooLong) {
    return <span className="inline-block w-14" aria-hidden="true" />;
  }
  return account ? (
    <span className="flex shrink-0 items-center gap-2">
      <Link href="/account" title={account.user.email} className="nav-link shrink-0">
        {account.isAdmin ? "Admin" : "My account"}
      </Link>
      <UserButton />
    </span>
  ) : (
    <Link href="/sign-in" className="nav-link shrink-0">
      Sign in
    </Link>
  );
}

type NavItem = { href: string; label: string; adminOnly?: boolean };

const NAV: NavItem[] = [
  { href: "/", label: "Overview" },
  { href: "/live", label: "Live call" },
  { href: "/demo", label: "Live demo" },
  // Admin-only items are hidden from everyone else. The pages (and, for the
  // console, the database) enforce this independently of the menu.
  { href: "/operator", label: "Incident console", adminOnly: true },
  { href: "/analyze", label: "Analyzer" },
  { href: "/evidence", label: "Evidence", adminOnly: true },
  { href: "/network", label: "Campaigns", adminOnly: true },
  { href: "/limits", label: "Limits", adminOnly: true },
];

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useSettings();
  const { account } = useAccount();
  const nav = NAV.filter((item) => !item.adminOnly || account?.isAdmin);

  return (
    <header className="site-header sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" aria-label="Interlock home" className="flex shrink-0 items-center gap-2.5 font-semibold tracking-tight text-ink">
          <span aria-hidden="true" className="brand-symbol">i<span className="brand-symbol-dot" /></span>
          <span className="text-lg tracking-[-0.055em]">interlock<span className="text-brand">.</span></span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 xl:flex">
          {nav.map((item) => {
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
        {nav.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`nav-link shrink-0 ${active ? "nav-link-active" : ""}`}>{item.label}</Link>;
        })}
      </nav>
    </header>
  );
}


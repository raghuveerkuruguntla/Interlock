"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALE_NAMES, LOCALES } from "@/lib/engine/copy";
import { useSettings } from "./settings";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/demo", label: "Live demo" },
  { href: "/network", label: "Campaign network" },
  { href: "/evidence", label: "Evidence" },
  { href: "/limits", label: "Limits" },
];

function Toggle({
  pressed,
  onClick,
  children,
  title,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={title}
      onClick={onClick}
      className="rounded-md border border-line px-2 py-1 text-xs font-medium transition-colors hover:bg-surface-2 aria-pressed:border-brand aria-pressed:bg-brand-soft aria-pressed:text-brand"
    >
      {children}
    </button>
  );
}

export function Header() {
  const pathname = usePathname();
  const { locale, setLocale, largeType, setLargeType, theme, setTheme } = useSettings();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-md border border-line-strong bg-surface-2 text-[13px]"
          >
            ⟡
          </span>
          <span>Interlock</span>
        </Link>

        <nav aria-label="Main" className="order-3 w-full sm:order-none sm:w-auto">
          <ul className="flex flex-wrap items-center gap-1 text-sm">
            {NAV.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-md px-2.5 py-1.5 transition-colors ${
                      active
                        ? "bg-surface-2 font-medium text-ink"
                        : "text-muted hover:bg-surface-2 hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <div
            role="group"
            aria-label="Language"
            className="flex items-center gap-1 rounded-md border border-line p-0.5"
          >
            {LOCALES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                aria-pressed={locale === code}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  locale === code ? "bg-brand-soft text-brand" : "text-muted hover:text-ink"
                }`}
              >
                {LOCALE_NAMES[code]}
              </button>
            ))}
          </div>

          <Toggle
            pressed={largeType}
            onClick={() => setLargeType(!largeType)}
            title="Scale the whole interface to 125%"
          >
            A<span className="text-[1.1em]">A</span>
          </Toggle>

          <Toggle
            pressed={theme === "dark"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title="Switch between light and dark"
          >
            {theme === "dark" ? "☾" : "☀"}
          </Toggle>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-10 text-sm text-muted sm:px-6">
        <p className="max-w-3xl">
          <strong className="font-semibold text-ink">Everything here is synthetic.</strong>{" "}
          Interlock is a research prototype built for a hackathon. It uses no real customer
          data, no T-Mobile internal systems, no call recordings, no network telemetry and no
          carrier API. It cannot intercept a real message or change a real account. The
          scenarios are fiction, written for this project.
        </p>
        <p className="mt-4 max-w-3xl">
          Do not enter real passwords, one-time codes, card numbers or personal messages
          anywhere in this app.
        </p>
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/limits" className="underline underline-offset-4 hover:text-ink">
            What we did not solve
          </Link>
          <Link href="/evidence" className="underline underline-offset-4 hover:text-ink">
            How it was measured
          </Link>
          <a
            href="https://github.com/raghuveerkuruguntla/Interlock"
            className="underline underline-offset-4 hover:text-ink"
            rel="noreferrer"
          >
            Source on GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}

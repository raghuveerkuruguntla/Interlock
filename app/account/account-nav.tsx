"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAccount } from "@/components/account";

const TABS = [
  { href: "/account", label: "Dashboard" },
  { href: "/account/privacy", label: "Privacy & consent" },
  { href: "/account/security", label: "Security & activity" },
];

export function AccountNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { account, signOut } = useAccount();
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{account ? account.user.name : "Your account"}</h1>
        <span className="text-sm text-muted">{account?.user.email}</span>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.push("/");
            router.refresh();
          }}
          className="ml-auto rounded-md border border-line px-3 py-1.5 text-sm"
        >
          Sign out
        </button>
      </div>
      <nav aria-label="Account" className="mt-4 border-b border-line">
        <ul className="-mb-px flex flex-wrap gap-1 text-sm">
          {TABS.map((t) => {
            const active = t.href === "/account" ? pathname === "/account" || pathname.startsWith("/account/incidents") : pathname.startsWith(t.href);
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`block border-b-2 px-3 py-2 ${active ? "border-brand font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}
                >
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

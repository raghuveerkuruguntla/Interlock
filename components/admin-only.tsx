import Link from "next/link";

/** Shown in place of an admin-only page to anyone who is not the admin. Reveals nothing about its contents. */
export function AdminOnly({ what }: { what: string }) {
  return (
    <div className="mx-auto max-w-2xl px-5 pb-20 pt-16 sm:px-8">
      <p className="section-kicker">ADMIN ONLY</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">This page is for the Interlock admin</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {what} only available to the Interlock admin account. Your own reported incidents and their
        live status are on your dashboard.
      </p>
      <Link href="/account" className="demo-play-button mt-6 inline-flex">Go to my dashboard</Link>
    </div>
  );
}

import type { Metadata } from "next";
import { AdminOnly } from "@/components/admin-only";
import { IncidentOperatorConsole } from "@/components/incident-workflow";
import { currentUserIsAdmin } from "@/lib/server/accounts";

export const metadata: Metadata = {
  title: "Incident console",
  description: "Review, acknowledge and resolve reported incidents.",
};

export const dynamic = "force-dynamic";

/**
 * The admin's incident console.
 *
 * Checked here on the server (signed in, with the admin role in Clerk), and
 * again by the database on every read and every status change — a customer who
 * reached this page by any route would still see an empty queue and have
 * every action refused.
 */
export default async function OperatorPage() {
  if (!(await currentUserIsAdmin())) return <AdminOnly what="The incident console is" />;

  return (
    <div className="mx-auto max-w-5xl px-5 pb-20 pt-10 sm:px-8">
      <header>
        <p className="section-kicker">ADMIN</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Incident console</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
          Every incident reported by every customer, updating live. Status changes appear on the
          customer&apos;s own dashboard immediately.
        </p>
      </header>
      <IncidentOperatorConsole />
    </div>
  );
}

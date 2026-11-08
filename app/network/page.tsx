import type { Metadata } from "next";
import Link from "next/link";
import { listCampaigns } from "@/lib/server/campaign-store";
import report from "@/public/evidence/report.json";

export const metadata: Metadata = {
  title: "Campaign network",
  description:
    "Herd immunity without disclosure: campaigns clustered from 64-bit signatures, with no message text crossing the device boundary.",
};

export const dynamic = "force-dynamic";

function hoursAgo(seconds: number): string {
  const hours = Math.max(1, Math.round((Date.now() / 1000 - seconds) / 3600));
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default async function NetworkPage() {
  const campaigns = await listCampaigns();
  const totalReports = campaigns.reduce((sum, c) => sum + c.reports, 0);
  const signatures = report.campaignSignatures;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Campaign network</h1>
        <p className="mt-3 max-w-3xl text-lg leading-relaxed text-muted">
          Reframing the product from a filter into an immune system. One person reports;
          everyone else targeted by the same campaign is protected within minutes — and the
          only thing that travels is a hash.
        </p>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Campaigns tracked
          </p>
          <p className="mt-1.5 text-3xl font-semibold">{campaigns.length}</p>
        </div>
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Reports</p>
          <p className="mt-1.5 text-3xl font-semibold">{totalReports.toLocaleString()}</p>
        </div>
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Message text stored
          </p>
          <p className="mt-1.5 text-3xl font-semibold" style={{ color: "var(--ok)" }}>
            None
          </p>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">Live campaigns</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Surfacing the campaign rather than a per-message verdict is also better product:
          “this is campaign C-0002, first seen 19 hours ago, 14,207 reports” tells a customer
          something a red banner never could. Report a thread from{" "}
          <Link href="/demo" className="underline underline-offset-4">
            the demo
          </Link>{" "}
          and it appears here.
        </p>

        <ul className="mt-5 space-y-3">
          {campaigns.map((campaign) => (
            <li key={campaign.id} className="rounded-card border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="font-mono text-sm text-ink">{campaign.id}</span>
                <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-muted">
                  {campaign.family}
                </span>
                {campaign.blocking ? (
                  <span
                    className="rounded px-2 py-0.5 text-xs font-medium"
                    style={{ background: "var(--tier-critical-soft)", color: "var(--tier-critical)" }}
                  >
                    blocking
                  </span>
                ) : (
                  <span
                    className="rounded px-2 py-0.5 text-xs font-medium"
                    style={{ background: "var(--tier-elevated-soft)", color: "var(--tier-elevated)" }}
                  >
                    informing only — not enough independent reports
                  </span>
                )}
                <span className="ml-auto text-xs text-faint">
                  first seen {hoursAgo(campaign.firstSeen)}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
                <span>
                  <strong className="font-semibold text-ink">
                    {campaign.reports.toLocaleString()}
                  </strong>{" "}
                  <span className="text-muted">reports</span>
                </span>
                <span>
                  <strong className="font-semibold text-ink">
                    {campaign.reporters.toLocaleString()}
                  </strong>{" "}
                  <span className="text-muted">distinct reporters</span>
                </span>
                <span className="font-mono text-xs text-faint">
                  signature {campaign.signature}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 border-t border-line pt-10">
        <h2 className="text-xl font-semibold tracking-tight">Why the hash is safe to send</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
          {signatures.description}
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-card border border-line bg-surface p-5">
            <h3 className="text-sm font-semibold">Variants of one campaign cluster</h3>
            <ul className="mt-3 space-y-2">
              {signatures.variantDistances.map((v, i) => (
                <li key={i} className="text-xs">
                  <span className="font-mono" style={{ color: "var(--ok)" }}>
                    {String(v.distance).padStart(2, " ")} bits apart
                  </span>
                  <p className="mt-0.5 font-mono text-faint">{v.normalisedTemplate}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-snug text-muted">
              The name, the amount and the short link all differ between these. Normalising
              them to placeholders before hashing is what lets one report cover the whole
              campaign.
            </p>
          </div>

          <div className="rounded-card border border-line bg-surface p-5">
            <h3 className="text-sm font-semibold">Unrelated messages stay apart</h3>
            <ul className="mt-3 space-y-2">
              {signatures.unrelatedDistances.map((u, i) => (
                <li key={i} className="text-xs">
                  <span className="font-mono text-muted">
                    {String(u.distance).padStart(2, " ")} bits apart
                  </span>
                  <p className="mt-0.5 text-faint">{u.text}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-snug text-muted">
              The matching radius is {signatures.radius} bits, chosen from this gap rather
              than picked by feel.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-12 border-t border-line pt-10">
        <h2 className="text-xl font-semibold tracking-tight">
          The report button is a weapon if you build it wrong
        </h2>
        <p className="mt-2 max-w-3xl leading-relaxed text-muted">
          A system where one report blocks a sender is a denial-of-service tool pointed at
          legitimate businesses. Anyone can send themselves a message that looks like a
          competitor&apos;s marketing and report it. Naming that before someone else does is
          worth more than the feature.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {[
            [
              "Reputation-weighted reporting",
              "A campaign informs until enough distinct reporters have seen it. The first report never blocks.",
            ],
            [
              "A verified-brand allowlist",
              "Real senders cannot be knocked out by volume alone.",
            ],
            [
              "Rate limits per reporter",
              "Mass reporting from one source is the signature of abuse, not of a campaign.",
            ],
            [
              "Review before a hard block",
              "The step between informing and blocking is the one that needs a human.",
            ],
          ].map(([title, body]) => (
            <div key={title} className="rounded-card border border-line bg-surface p-4">
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-snug text-muted">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 max-w-3xl rounded-card border border-dashed border-line p-4 text-sm leading-relaxed text-muted">
          <strong className="text-ink">What is not built here:</strong> this store is
          in-memory and resets when the server instance recycles, the reporter identities are
          notional, and the rate limits are described rather than enforced. A real deployment
          needs a shared store and real reporter identity before any of this could block
          anything.
        </p>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { listCampaigns } from "@/lib/server/campaign-store";
import report from "@/public/evidence/report.json";

export const metadata: Metadata = {
  title: "Campaign network",
  description:
    "Simulated campaign fixtures and an unverified local demo queue. No reports are treated as trusted intelligence and no blocking is enabled.",
};

export const dynamic = "force-dynamic";

function hoursAgo(seconds: number): string {
  const hours = Math.max(1, Math.round((Date.now() / 1000 - seconds) / 3600));
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function NetworkPage() {
  const campaigns = listCampaigns();
  const totalReports = campaigns.reduce((sum, c) => sum + c.reports, 0);
  const signatures = report.campaignSignatures;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Campaign network</h1>
        <p className="mt-3 max-w-3xl text-lg leading-relaxed text-muted">
          These simulated fixtures demonstrate signature clustering only. User submissions
          remain unverified in a local demo queue; they do not update lookups or trigger blocking.
        </p>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Simulated fixtures
          </p>
          <p className="mt-1.5 text-3xl font-semibold">{campaigns.length}</p>
        </div>
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Reports</p>
          <p className="mt-1.5 text-3xl font-semibold">{totalReports.toLocaleString()}</p>
          <p className="mt-1 text-xs text-faint">example reports, not verified submissions</p>
        </div>
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            User message text stored in reports
          </p>
          <p className="mt-1.5 text-3xl font-semibold" style={{ color: "var(--ok)" }}>
            None
          </p>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">Simulated campaign fixtures</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          All entries and counts below are synthetic demo data, not verified real-world users.
          Reports submitted from{" "}
          <Link href="/demo" className="underline underline-offset-4">
            the demo
          </Link>{" "}
          are queued separately and never appear in these lookup results.
        </p>

        <ul className="mt-5 space-y-3">
          {campaigns.map((campaign) => (
            <li key={campaign.id} className="rounded-card border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="font-mono text-sm text-ink">{campaign.id}</span>
                <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-muted">
                  {campaign.family}
                </span>
                <span className="rounded px-2 py-0.5 text-xs font-medium" style={{ background: "var(--tier-elevated-soft)", color: "var(--tier-elevated)" }}>
                  SIMULATED FIXTURE · informational only
                </span>
                <span className="ml-auto text-xs text-faint">
                  first seen {hoursAgo(campaign.firstSeen)}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
                <span>
                  <strong className="font-semibold text-ink">
                    {campaign.reports.toLocaleString()}
                  </strong>{" "}
                  <span className="text-muted">example reports</span>
                </span>
                <span>
                  <strong className="font-semibold text-ink">
                    {campaign.reporters.toLocaleString()}
                  </strong>{" "}
                  <span className="text-muted">simulated reporter count, not verified users</span>
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
        <h2 className="text-xl font-semibold tracking-tight">What the signature does and does not protect</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
          Reports contain a SimHash signature and fixed labels, never raw message text, card
          details, OTP values or conversation histories. SimHash is not encryption or a
          cryptographic privacy guarantee: dictionary-based inference may be possible when
          candidate messages can be guessed. The signature is used here only for simulated lookup.
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
                The matching radius is {signatures.radius} bits, measured on synthetic examples.
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
              "Demo queue only",
              "Submissions are unverified and isolated from campaign lookup results.",
            ],
            [
              "No blocking",
              "Campaign matches are informational fixtures. This build cannot block a sender or act on a carrier account.",
            ],
            [
              "No identity claims",
              "Reporter identity is not authenticated, and IP addresses are not treated as proof of distinct users.",
            ],
            [
              "Later integration",
              "Durable authenticated reporting and moderation are planned for the SpacetimeDB integration.",
            ],
          ].map(([title, body]) => (
            <div key={title} className="rounded-card border border-line bg-surface p-4">
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-snug text-muted">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 max-w-3xl rounded-card border border-dashed border-line p-4 text-sm leading-relaxed text-muted">
          <strong className="text-ink">Demo limitation:</strong> the pending queue is in-memory
          and resets when the server instance recycles. No production security control or
          in-memory rate limit is claimed; durable authentication and moderation are not yet built.
        </p>
      </section>
    </div>
  );
}

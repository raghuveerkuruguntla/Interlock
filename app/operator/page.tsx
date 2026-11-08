import type { Metadata } from "next";
import { IncidentOperatorConsole } from "@/components/incident-workflow";

export const metadata: Metadata = {
  title: "Simulated incident console",
  description: "Authorized, real-time simulated incident coordination backed by SpacetimeDB.",
};

export default function OperatorPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 pb-20 pt-10 sm:px-8">
      <header>
        <p className="section-kicker">INCIDENT COORDINATION / SIMULATION</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Operator console</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
          Durable incident state and live updates run through SpacetimeDB. This console is a challenge demo only, not a T-Mobile service.
        </p>
      </header>
      <IncidentOperatorConsole />
    </div>
  );
}
import type { Metadata } from "next";
import Link from "next/link";
import { NOTICE_VERSION } from "@/lib/account/types";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "What Interlock analyses, when, what it keeps, who processes it, and how to turn it off.",
};

const ROWS: [string, string, string][] = [
  ["Live call text", "Only during a live session you start, only for numbers that are not saved contacts", "Microphone mode: never leaves your browser's memory (your browser's speech service may process the audio). Phone mode: held on our server for at most two hours, deleted the moment you end the session."],
  ["Call audio", "Never recorded by Interlock", "Not stored. In phone mode Twilio transcribes the audio and sends us text only."],
  ["Message text", "Only messages you show it, from numbers that are not saved contacts", "Scored in your browser. Never sent to our server."],
  ["Campaign fingerprint", "Only when you press Report", "A 16-character hash of the opening line, the stage and the risk level. Cannot be turned back into words. Not linked to your account."],
  ["Incident reports", "Only if “Keep my incident reports” is on, and only when you press Save", "Title, summary, short quotes and next steps. Deleted when you delete the report, turn report-keeping off, or delete your account."],
  ["Account", "When you sign up", "Clerk, our sign-in provider, holds your name, email and sign-in details; Interlock never sees your password. Interlock keeps your consent choices and history and an activity log."],
  ["Reported incidents", "Only when you submit one", "A category, severity, urgency, coarse time and your account's database identity. Visible to you and the Interlock admin only."],
];

export default function PrivacyNoticePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 pt-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy notice</h1>
      <p className="mt-2 text-sm text-faint">Version {NOTICE_VERSION}</p>
      <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted">
        Interlock is opt-in at every step. Creating an account turns nothing on; each kind of
        analysis is a separate switch that starts off, and turning one off takes effect on the next
        request — including ending a live session that is already running.
      </p>

      <div className="mt-8 overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="p-3">What</th>
              <th className="p-3">When</th>
              <th className="p-3">Where it goes, and for how long</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {ROWS.map(([what, when, where]) => (
              <tr key={what} className="align-top">
                <th className="p-3 font-medium">{what}</th>
                <td className="p-3 text-muted">{when}</td>
                <td className="p-3 text-muted">{where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-10 space-y-4 text-sm leading-relaxed">
        <h2 className="text-xl font-semibold">Which calls and messages are analysed</h2>
        <p>
          Only ones from numbers that are not in your contacts, and — if you leave “Skip people you
          talk to often” on — not ones from numbers you call or text regularly. Most scams come from
          numbers you have never dealt with. A caller can fake a familiar number, so this is a
          privacy rule, not a promise that familiar numbers are safe.
        </p>
        <p>
          A website cannot hear an ordinary phone call. Interlock only hears a call when you start a
          live session: either through this device&apos;s microphone with the call on speaker, or by
          the call coming through the Interlock demo number.
        </p>

        <h2 className="pt-4 text-xl font-semibold">Everyone on the call</h2>
        <p>
          Before a live session starts you confirm that everyone on the call knows it is being
          analysed. In phone mode the caller also hears a spoken notice before the call connects.
          Some states require every participant&apos;s consent to record or transcribe a call.
        </p>

        <h2 className="pt-4 text-xl font-semibold">Who else processes data</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Your browser&apos;s speech service</strong> (microphone mode). Chrome, for example, sends audio to Google to turn it into text.</li>
          <li><strong>Twilio</strong> (phone mode) carries the call and transcribes it. Twilio keeps call metadata such as numbers and duration under its own policies.</li>
          <li><strong>Clerk</strong> handles sign-up and sign-in, and stores your name, email and sign-in details.</li>
          <li><strong>SpacetimeDB</strong> stores the minimal incidents you choose to report, so you and the Interlock admin can follow them.</li>
          <li><strong>Our hosting and database provider</strong> stores account data and, briefly, phone-mode transcript text.</li>
        </ul>

        <h2 className="pt-4 text-xl font-semibold">What we never do</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Record call audio.</li>
          <li>Use your data to train models. Training-data sharing is not offered.</li>
          <li>Change anything on a real carrier or bank account. Holds and monitoring in this prototype are simulated and labelled.</li>
          <li>Sell or share your data for advertising.</li>
        </ul>

        <h2 className="pt-4 text-xl font-semibold">Your controls</h2>
        <p>
          Change any switch in <Link href="/account/privacy" className="text-brand underline">Privacy &amp; consent</Link>,
          see every change you have made, download everything we hold, delete individual reports, or
          delete your whole account from <Link href="/account/security" className="text-brand underline">Security &amp; activity</Link>.
        </p>
      </section>
    </div>
  );
}

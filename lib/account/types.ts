/**
 * Account, consent and incident shapes, shared by the browser and the server.
 *
 * Consent is the product's contract with the customer, so it is modelled as
 * data rather than a checkbox: every switch defaults OFF, every change is
 * timestamped into a log the customer can read, and revoking takes effect on
 * the next request — there is no grace period in which we keep listening.
 */

import type { ExposureKind, SignalId, Stage, Tier } from "@/lib/engine/types";

/** Bump when the wording of the notice changes, so old consent can be re-asked. */
export const NOTICE_VERSION = "2026-11-08";

export interface ConsentSettings {
  /**
   * Live analysis of calls. Only ever for calls the customer starts a live
   * session for, and only when the number is not a saved contact.
   */
  callAnalysis: boolean;
  /** Analysis of messages from numbers that are not saved contacts. */
  messageAnalysis: boolean;
  /** Also skip numbers you talk to often, even if they are not saved. */
  skipFrequentNumbers: boolean;
  /** Share a non-reversible campaign signature when you report a scam. */
  networkReporting: boolean;
  /** Keep a short written report of each incident in your account. */
  saveIncidents: boolean;
  /**
   * Training-data sharing is not offered by this prototype: there is no
   * pipeline that could honour a deletion request for it. Modelled so the UI
   * can say so plainly, and pinned to false on the server.
   */
  trainingData: false;
  /** Which version of the notice these choices were made against. */
  noticeVersion: string | null;
  updatedAt: number | null;
}

export const DEFAULT_CONSENT: ConsentSettings = {
  callAnalysis: false,
  messageAnalysis: false,
  skipFrequentNumbers: true,
  networkReporting: false,
  saveIncidents: false,
  trainingData: false,
  noticeVersion: null,
  updatedAt: null,
};

export type ConsentKey = "callAnalysis" | "messageAnalysis" | "skipFrequentNumbers" | "networkReporting" | "saveIncidents";

export const CONSENT_KEYS: ConsentKey[] = [
  "callAnalysis",
  "messageAnalysis",
  "skipFrequentNumbers",
  "networkReporting",
  "saveIncidents",
];

export interface ConsentLogEntry {
  at: number;
  key: ConsentKey | "notice";
  value: boolean | string;
}

export interface ActivityEntry {
  at: number;
  kind:
    | "account_created"
    | "signed_in"
    | "signed_out"
    | "consent_changed"
    | "live_session_started"
    | "live_session_ended"
    | "incident_saved"
    | "incident_deleted"
    | "data_exported";
  detail?: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: number;
}

export type CustomerAction =
  | "ended_call"
  | "verified_independently"
  | "continued"
  | "reported_exposure"
  | "none";

export interface IncidentSignal {
  id: SignalId;
  label: string;
  /** A short quote, at most 120 characters. Never a full transcript. */
  evidence: string;
}

export interface IncidentReport {
  id: string;
  createdAt: number;
  source: "live_call" | "live_message" | "demo";
  title: string;
  summary: string;
  stage: Stage;
  tier: Tier;
  risk: number;
  /** How sure we are, in words, so the report never overstates. */
  confidence: string;
  signals: IncidentSignal[];
  customerAction: CustomerAction;
  customerResponse: string;
  recommendedAction: string;
  nextSteps: string[];
  exposure: ExposureKind | null;
  /** Signature sent to the campaign network, if the customer chose to report. */
  campaignSignature: string | null;
  reportedToNetwork: boolean;
}

export interface AccountSnapshot {
  user: PublicUser;
  consent: ConsentSettings;
  consentLog: ConsentLogEntry[];
  activity: ActivityEntry[];
  incidents: IncidentReport[];
  store: { kind: "memory" | "redis"; durable: boolean };
}

export const CONSENT_COPY: Record<ConsentKey, { title: string; body: string; when: string }> = {
  callAnalysis: {
    title: "Live call analysis",
    body: "When you start a live session, Interlock turns speech on that call into text and checks it for scam patterns while you talk.",
    when: "Only calls from numbers that are not in your contacts, and only while a live session you started is running. Never your other calls.",
  },
  messageAnalysis: {
    title: "Message analysis",
    body: "Checks text messages for scam patterns, on this device.",
    when: "Only messages from numbers that are not in your contacts. Messages from saved contacts are never read.",
  },
  skipFrequentNumbers: {
    title: "Skip people you talk to often",
    body: "Numbers you have called or texted regularly are treated like contacts and skipped, even if you never saved them.",
    when: "On by default. Note: a caller can fake a number, so a familiar number is a hint, not a guarantee.",
  },
  networkReporting: {
    title: "Help warn other people",
    body: "When you report a scam, we share a 16-character fingerprint of the first message — never the words, your number, or who you are.",
    when: "Only when you press Report. Nothing is shared automatically.",
  },
  saveIncidents: {
    title: "Keep my incident reports",
    body: "Saves a short written summary of each incident to your account so you can come back to the next steps.",
    when: "Short quotes only, never a full transcript or recording. Delete any report, or your whole account, at any time.",
  },
};

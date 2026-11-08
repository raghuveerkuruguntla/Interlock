"use client";

import { CONSENT_COPY, CONSENT_KEYS, type ConsentKey, type ConsentSettings } from "@/lib/account/types";

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-40"
      style={{
        background: checked ? "var(--brand)" : "var(--surface-3)",
        borderColor: checked ? "var(--brand)" : "var(--border-strong)",
      }}
    >
      <span
        aria-hidden
        className="absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-[left]"
        style={{ left: checked ? "1.375rem" : "0.125rem", width: "1.125rem", height: "1.125rem" }}
      />
    </button>
  );
}

/** Every consent switch, with exactly what it covers and when it applies. */
export function ConsentToggles({
  value,
  onChange,
  busy,
}: {
  value: Pick<ConsentSettings, ConsentKey>;
  onChange: (key: ConsentKey, v: boolean) => void;
  busy?: boolean;
}) {
  return (
    <ul className="divide-y divide-[var(--border)] rounded-card border border-line bg-surface">
      {CONSENT_KEYS.map((key) => {
        const c = CONSENT_COPY[key];
        return (
          <li key={key} className="flex gap-4 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{c.title}</p>
              <p className="mt-0.5 text-sm text-muted">{c.body}</p>
              <p className="mt-1 text-xs text-faint">{c.when}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Switch checked={value[key]} onChange={(v) => onChange(key, v)} label={c.title} disabled={busy} />
              <span className="text-[11px] font-medium uppercase tracking-wide text-faint">{value[key] ? "On" : "Off"}</span>
            </div>
          </li>
        );
      })}
      <li className="flex gap-4 p-4 opacity-70">
        <div className="min-w-0 flex-1">
          <p className="font-medium">Share my data to train models</p>
          <p className="mt-0.5 text-sm text-muted">
            Not offered. Interlock does not collect your data to train its models.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Switch checked={false} onChange={() => {}} label="Share my data to train models" disabled />
          <span className="text-[11px] font-medium uppercase tracking-wide text-faint">Off</span>
        </div>
      </li>
    </ul>
  );
}

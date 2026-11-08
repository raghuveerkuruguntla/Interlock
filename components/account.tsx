"use client";

/**
 * The signed-in account, shared by the header and every page.
 *
 * The session itself lives in an httpOnly cookie this code can never read;
 * this provider only holds what `/api/auth/me` returns, and refreshes it after
 * anything that changes the account.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AccountSnapshot, ConsentKey } from "@/lib/account/types";

interface Config {
  authSecret: boolean;
  store: { kind: "memory" | "redis"; durable: boolean };
}

interface AccountState {
  account: AccountSnapshot | null;
  config: Config | null;
  loading: boolean;
  refresh: () => Promise<AccountSnapshot | null>;
  setAccount: (a: AccountSnapshot | null) => void;
  signOut: () => Promise<void>;
  updateConsent: (
    patch: Partial<Record<ConsentKey, boolean>>,
    acceptNotice?: boolean,
  ) => Promise<AccountSnapshot | null>;
}

const AccountContext = createContext<AccountState | null>(null);

async function fetchMe(): Promise<{ account: AccountSnapshot | null; config: Config | null }> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) return { account: null, config: null };
    return (await res.json()) as { account: AccountSnapshot | null; config: Config };
  } catch {
    return { account: null, config: null };
  }
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await fetchMe();
    setAccount(data.account);
    setConfig(data.config);
    setLoading(false);
    return data.account;
  }, []);

  useEffect(() => {
    let live = true;
    fetchMe().then((data) => {
      if (!live) return;
      setAccount(data.account);
      setConfig(data.config);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => null);
    setAccount(null);
  }, []);

  const updateConsent = useCallback(
    async (patch: Partial<Record<ConsentKey, boolean>>, acceptNotice = false) => {
      const res = await fetch("/api/account/consent", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ consent: patch, acceptNotice }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { account: AccountSnapshot };
      setAccount(data.account);
      return data.account;
    },
    [],
  );

  const value = useMemo<AccountState>(
    () => ({ account, config, loading, refresh, setAccount, signOut, updateConsent }),
    [account, config, loading, refresh, signOut, updateConsent],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountState {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used inside AccountProvider");
  return ctx;
}

/** One-line warning when the deployment cannot keep accounts reliably. */
export function StorageNotice() {
  const { config } = useAccount();
  if (!config) return null;
  const problems: string[] = [];
  if (!config.store.durable)
    problems.push("accounts are kept in this server's memory and disappear when it restarts");
  if (!config.authSecret) problems.push("sign-ins use a temporary key and reset on restart");
  if (!problems.length) return null;
  return (
    <p className="rounded-md border border-dashed border-line bg-surface-2 px-3 py-2 text-xs leading-snug text-muted">
      <strong className="font-semibold text-ink">Prototype storage:</strong> {problems.join("; ")}.
      Set the Redis and <code className="font-mono">AUTH_SECRET</code> environment variables to make
      them durable.
    </p>
  );
}

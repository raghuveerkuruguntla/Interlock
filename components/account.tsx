"use client";

/**
 * The signed-in account, shared by the header and every page.
 *
 * Clerk owns the session. This provider holds what `/api/auth/me` returns —
 * the user's Interlock consent, history and whether they are the admin — and
 * refetches it whenever Clerk's signed-in user changes.
 */

import { useAuth, useClerk } from "@clerk/nextjs";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AccountSnapshot, ConsentKey } from "@/lib/account/types";

interface Config {
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
  const { isLoaded, userId } = useAuth();
  const clerk = useClerk();
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    const data = await fetchMe();
    setAccount(data.account);
    setConfig(data.config);
    return data.account;
  }, []);

  // Refetch whenever Clerk's user changes: sign-in, sign-out or account switch.
  useEffect(() => {
    if (!isLoaded) return;
    let live = true;
    fetchMe().then((data) => {
      if (!live) return;
      setAccount(data.account);
      setConfig(data.config);
      setLoadedFor(userId ?? null);
    });
    return () => {
      live = false;
    };
  }, [isLoaded, userId]);

  const signOut = useCallback(async () => {
    await clerk.signOut({ redirectUrl: "/" });
    setAccount(null);
  }, [clerk]);

  const updateConsent = useCallback(
    async (patch: Partial<Record<ConsentKey, boolean>>, acceptNotice = false) => {
      const res = await fetch("/api/account/consent", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ consent: patch, acceptNotice }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { account: AccountSnapshot };
      // The consent endpoint does not re-read Clerk metadata; keep the admin flag we already have.
      setAccount((prev) => ({ ...data.account, isAdmin: prev?.isAdmin ?? false }));
      return data.account;
    },
    [],
  );

  const loading = !isLoaded || loadedFor !== (userId ?? null);

  const value = useMemo<AccountState>(
    () => ({
      account: loading ? null : account,
      config,
      loading,
      refresh,
      setAccount,
      signOut,
      updateConsent,
    }),
    [account, config, loading, refresh, signOut, updateConsent],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountState {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used inside AccountProvider");
  return ctx;
}

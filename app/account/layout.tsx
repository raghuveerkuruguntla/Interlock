import { redirect } from "next/navigation";
import { currentAccountId, getSnapshot } from "@/lib/server/accounts";
import { AccountNav } from "./account-nav";

export const dynamic = "force-dynamic";

/**
 * Every page under /account is protected here, on the server, before any of
 * it renders. A missing, tampered or expired session never reaches the page.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const id = await currentAccountId();
  if (!id || !(await getSnapshot(id))) redirect("/signin?next=/account");
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6">
      <AccountNav />
      <div className="mt-6">{children}</div>
    </div>
  );
}

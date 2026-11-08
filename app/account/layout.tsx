import { redirect } from "next/navigation";
import { currentSnapshot } from "@/lib/server/accounts";
import { AccountNav } from "./account-nav";

export const dynamic = "force-dynamic";

/**
 * Every page under /account is protected here, on the server, before any of
 * it renders, as well as by the Clerk proxy. Each page shows only the signed-in
 * user's own data.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  // Creates the Interlock record on a Clerk user's first visit.
  if (!(await currentSnapshot())) redirect("/sign-in?redirect_url=/account");
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6">
      <AccountNav />
      <div className="mt-6">{children}</div>
    </div>
  );
}

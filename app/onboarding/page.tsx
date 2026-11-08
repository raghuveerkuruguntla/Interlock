import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentAccountId } from "@/lib/server/accounts";
import { OnboardingClient } from "./onboarding-client";

export const metadata: Metadata = { title: "Set up your protection" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  if (!(await currentAccountId())) redirect("/signup");
  return <OnboardingClient />;
}

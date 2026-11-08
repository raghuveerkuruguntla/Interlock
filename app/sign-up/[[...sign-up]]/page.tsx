import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <div className="mx-auto grid max-w-md place-items-center gap-4 px-4 pb-16 pt-12">
      {/* New accounts go straight to the consent walkthrough. Nothing is switched on until they choose. */}
      <SignUp signInUrl="/sign-in" forceRedirectUrl="/onboarding" />
      <p className="text-center text-xs leading-snug text-faint">
        Creating an account turns nothing on. Every kind of analysis starts switched off until you
        choose it. Read the <Link href="/privacy" className="underline">privacy notice</Link>.
      </p>
    </div>
  );
}

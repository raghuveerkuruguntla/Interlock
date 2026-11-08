import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="mx-auto grid max-w-md place-items-center px-4 pb-16 pt-12">
      <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/account" />
    </div>
  );
}

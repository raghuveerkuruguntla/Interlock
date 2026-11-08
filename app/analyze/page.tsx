import type { Metadata } from "next";
import { AnalyzerClient } from "./analyzer-client";

export const metadata: Metadata = {
  title: "Message analyzer",
  description: "Check a conversation for scam warning signs, on your device, without sending your messages anywhere.",
};

export default function AnalyzerPage() {
  return <AnalyzerClient />;
}

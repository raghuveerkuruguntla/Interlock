import type { Metadata } from "next";
import { AnalyzerClient } from "./analyzer-client";

export const metadata: Metadata = {
  title: "Message analyzer",
  description: "Analyze fictional conversation text using the real on-device Interlock thread engine, without sending raw messages to a server.",
};

export default function AnalyzerPage() {
  return <AnalyzerClient />;
}

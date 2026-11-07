import type { Metadata } from "next";
import { DemoClient } from "./demo-client";

export const metadata: Metadata = {
  title: "Live demo",
  description:
    "Replay a scam arc and watch the kill-chain state machine advance, with every safeguard computed in the browser from the events shown so far.",
};

export default function DemoPage() {
  return <DemoClient />;
}

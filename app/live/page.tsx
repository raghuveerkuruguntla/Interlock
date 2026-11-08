import type { Metadata } from "next";
import { LiveClient } from "./live-client";

export const metadata: Metadata = {
  title: "Live call protection",
  description:
    "A real, unscripted call transcribed live and scored sentence by sentence, with escalating warnings and a plain-language report at the end.",
};

export default function LivePage() {
  return <LiveClient />;
}

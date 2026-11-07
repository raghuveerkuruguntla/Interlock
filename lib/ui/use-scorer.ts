"use client";

import { useEffect, useState } from "react";
import { loadScorer, type Scorer } from "@/lib/engine/scorer";

export interface ScorerState {
  scorer: Scorer | null;
  loading: boolean;
  error: string | null;
}

/**
 * Load the scoring model into the browser, once per session.
 *
 * This is the only network request the detection path ever makes, and it goes
 * one way: a static asset comes down, nothing goes up. Everything the user
 * types is scored here, in their own tab.
 */
export function useScorer(): ScorerState {
  const [state, setState] = useState<ScorerState>({
    scorer: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let live = true;
    loadScorer()
      .then((scorer) => {
        if (live) setState({ scorer, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (live) {
          setState({
            scorer: null,
            loading: false,
            error: err instanceof Error ? err.message : "Could not load the model",
          });
        }
      });
    return () => {
      live = false;
    };
  }, []);

  return state;
}

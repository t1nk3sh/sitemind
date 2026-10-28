import { useCallback, useState } from "react";

import type { AnalysisEnvelope } from "./types";

export function useAnalysis<T>(runner: (payload: never) => Promise<AnalysisEnvelope<T>>) {
  const [result, setResult] = useState<AnalysisEnvelope<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (payload: unknown) => {
      setLoading(true);
      setError(null);
      try {
        const envelope = await runner(payload as never);
        setResult(envelope);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "The request failed.");
      } finally {
        setLoading(false);
      }
    },
    [runner],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, loading, error, run, reset };
}

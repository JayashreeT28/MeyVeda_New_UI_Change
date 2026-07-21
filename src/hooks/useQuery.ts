"use client";

/**
 * Generic React hook factory for data fetching.
 *
 * Provides a standardized { data, loading, error, refetch } pattern
 * used by all feature-specific hooks.
 */

import { useEffect, useState } from "react";

export function useQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
): { data: T | null; loading: boolean; error: string | null; refetch: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = () => {
    setLoading(true);
    fetcher()
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err) => {
        setError(err?.message ?? "Unknown error");
      })
      .finally(() => setLoading(false));
  };

  useEffect(fetch, deps);

  return { data, loading, error, refetch: fetch };
}

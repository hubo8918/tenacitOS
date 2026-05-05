"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseFetchOptions<T> {
  timeoutMs?: number;
  initialData?: T | null;
  fetchOnMount?: boolean;
  refreshIntervalMs?: number;
}

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function normalizeError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Unknown error";
}

export function useFetch<T>(url: string, options?: UseFetchOptions<T>): UseFetchResult<T> {
  const timeoutMs = options?.timeoutMs ?? 10_000;
  const fetchOnMount = options?.fetchOnMount ?? true;
  const refreshIntervalMs = options?.refreshIntervalMs;

  const [data, setData] = useState<T | null>(options?.initialData ?? null);
  const [loading, setLoading] = useState(fetchOnMount && !options?.initialData);
  const [error, setError] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort("unmount");
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!mountedRef.current) return;

    // Cancel previous in-flight request so we don't keep stale loading cycles around.
    controllerRef.current?.abort("replaced");

    const controller = new AbortController();
    controllerRef.current = controller;

    const timeoutHandle = window.setTimeout(() => {
      controller.abort("timeout");
    }, timeoutMs);

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.status}`);
      }

      const json = (await res.json()) as T;

      if (!mountedRef.current || controllerRef.current !== controller) return;
      setData(json);
    } catch (err) {
      if (!mountedRef.current || controllerRef.current !== controller) return;

      if (controller.signal.aborted) {
        if (controller.signal.reason === "timeout") {
          const seconds = Math.max(1, Math.round(timeoutMs / 1000));
          setError(`Request timed out after ${seconds}s`);
        }
        return;
      }

      setError(normalizeError(err));
    } finally {
      window.clearTimeout(timeoutHandle);

      if (controllerRef.current === controller) {
        controllerRef.current = null;
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }
  }, [timeoutMs, url]);

  useEffect(() => {
    if (!fetchOnMount) return;
    fetchData();
  }, [fetchData, fetchOnMount]);

  useEffect(() => {
    if (!refreshIntervalMs || refreshIntervalMs <= 0) return;

    const intervalId = window.setInterval(() => {
      fetchData();
    }, refreshIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchData, refreshIntervalMs]);

  return { data, loading, error, refetch: fetchData };
}

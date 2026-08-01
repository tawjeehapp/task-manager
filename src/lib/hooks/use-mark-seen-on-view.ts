"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

type UseMarkSeenOnViewOptions = {
  /** When false, do not mark (e.g. bell dropdown closed). Defaults to true. */
  enabled?: boolean;
  unreadIds: readonly string[];
  endpoint: string;
  invalidateQueryKey: readonly unknown[];
};

/**
 * Marks the given unread IDs as read once they appear in the current view.
 * Dedupes submissions so invalidate/refetch cycles do not loop.
 */
export function useMarkSeenOnView({
  enabled = true,
  unreadIds,
  endpoint,
  invalidateQueryKey,
}: UseMarkSeenOnViewOptions): void {
  const queryClient = useQueryClient();
  const submittedRef = useRef(new Set<string>());
  const unreadKey = unreadIds.join(",");
  const invalidateKey = JSON.stringify(invalidateQueryKey);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const pending = unreadIds.filter((id) => !submittedRef.current.has(id));
    if (pending.length === 0) {
      return;
    }

    for (const id of pending) {
      submittedRef.current.add(id);
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: pending }),
        });

        if (!response.ok) {
          for (const id of pending) {
            submittedRef.current.delete(id);
          }
          return;
        }

        if (!cancelled) {
          await queryClient.invalidateQueries({
            queryKey: [...invalidateQueryKey],
          });
        }
      } catch {
        for (const id of pending) {
          submittedRef.current.delete(id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // unreadKey / invalidateKey stand in for array identity without re-firing every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable deps
  }, [enabled, unreadKey, endpoint, invalidateKey, queryClient]);
}

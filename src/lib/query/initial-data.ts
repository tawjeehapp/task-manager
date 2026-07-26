/**
 * Seed TanStack Query with server-fetched data without an immediate remount refetch.
 * Bare `initialData` is treated as stale; pairing with `initialDataUpdatedAt` +
 * the app default `staleTime` (30s) keeps the first paint clean.
 */
export function withInitialData<T>(data: T) {
  return {
    initialData: data,
    initialDataUpdatedAt: Date.now(),
  } as const;
}

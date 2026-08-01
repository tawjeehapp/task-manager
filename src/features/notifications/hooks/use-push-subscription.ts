"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import {
  getPushSubscriptionStatus,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  type PushSubscriptionStatus,
} from "@/lib/push/subscribe";

const PUSH_STATUS_QUERY_KEY = ["push", "status"] as const;

type ServerStatus = { subscribed: boolean };

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as {
    data?: T;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Request failed");
  }
  return payload.data as T;
}

export function usePushSubscription() {
  const queryClient = useQueryClient();
  const [browserStatus, setBrowserStatus] =
    useState<PushSubscriptionStatus | null>(null);
  const [browserReady, setBrowserReady] = useState(false);

  const refreshBrowserStatus = useCallback(async () => {
    if (!isPushSupported()) {
      setBrowserStatus("unsupported");
      setBrowserReady(true);
      return "unsupported" as const;
    }
    const status = await getPushSubscriptionStatus();
    setBrowserStatus(status);
    setBrowserReady(true);
    return status;
  }, []);

  useEffect(() => {
    void refreshBrowserStatus();
  }, [refreshBrowserStatus]);

  const serverQuery = useQuery({
    queryKey: PUSH_STATUS_QUERY_KEY,
    queryFn: () =>
      fetch("/api/push/status").then((res) => readApi<ServerStatus>(res)),
    enabled: browserReady && browserStatus !== "unsupported",
    refetchOnWindowFocus: true,
  });

  const status: PushSubscriptionStatus = (() => {
    if (!browserReady || browserStatus === null) {
      return "unsupported";
    }
    if (
      browserStatus === "unsupported" ||
      browserStatus === "denied" ||
      browserStatus === "prompt"
    ) {
      return browserStatus;
    }
    if (browserStatus === "subscribed" || serverQuery.data?.subscribed) {
      return "subscribed";
    }
    return "unsubscribed";
  })();

  const enableMutation = useMutation({
    mutationFn: async () => {
      const sub = await subscribeToPush();
      if (!sub) {
        const next = await refreshBrowserStatus();
        if (next === "denied") {
          throw new Error("denied");
        }
        throw new Error("subscribe_failed");
      }
      await refreshBrowserStatus();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PUSH_STATUS_QUERY_KEY });
    },
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      await unsubscribeFromPush();
      await refreshBrowserStatus();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PUSH_STATUS_QUERY_KEY });
    },
  });

  return {
    status,
    isLoading: !browserReady || serverQuery.isLoading,
    isSupported: browserStatus !== "unsupported",
    enable: enableMutation.mutateAsync,
    disable: disableMutation.mutateAsync,
    isEnabling: enableMutation.isPending,
    isDisabling: disableMutation.isPending,
    enableError: enableMutation.error,
    disableError: disableMutation.error,
    refresh: refreshBrowserStatus,
  };
}

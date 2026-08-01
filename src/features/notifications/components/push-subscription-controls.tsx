"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { usePushSubscription } from "@/features/notifications/hooks/use-push-subscription";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function PushSubscriptionControls() {
  const t = useTranslations("notifications.push");
  const {
    status,
    isLoading,
    isSupported,
    enable,
    disable,
    isEnabling,
    isDisabling,
  } = usePushSubscription();
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return null;
  }

  if (!isSupported || status === "unsupported") {
    return (
      <div className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
        {t("unsupported")}
      </div>
    );
  }

  const busy = isEnabling || isDisabling;

  return (
    <div className="flex flex-col gap-2 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{t("title")}</span>
          <Badge variant="secondary">
            {status === "subscribed"
              ? t("statusSubscribed")
              : status === "denied"
                ? t("statusDenied")
                : t("statusOff")}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {status === "denied" ? t("deniedHint") : t("description")}
        </p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {status === "subscribed" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setError(null);
              void disable().catch(() => setError(t("disableError")));
            }}
          >
            {isDisabling ? t("disabling") : t("disable")}
          </Button>
        ) : status !== "denied" ? (
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => {
              setError(null);
              void enable().catch((err: unknown) => {
                const code =
                  err instanceof Error ? err.message : "subscribe_failed";
                setError(
                  code === "denied" ? t("deniedHint") : t("enableError"),
                );
              });
            }}
          >
            {isEnabling
              ? t("enabling")
              : status === "unsubscribed"
                ? t("reEnable")
                : t("enable")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

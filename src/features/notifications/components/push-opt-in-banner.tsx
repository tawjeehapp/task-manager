"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { useTranslations } from "next-intl";

import { usePushSubscription } from "@/features/notifications/hooks/use-push-subscription";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "push-optin-dismissed-at";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function isDismissedRecently(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) {
      return false;
    }
    const at = Number(raw);
    if (!Number.isFinite(at)) {
      return false;
    }
    return Date.now() - at < DISMISS_MS;
  } catch {
    return false;
  }
}

function markDismissed(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // ignore quota / private mode
  }
}

export function PushOptInBanner() {
  const t = useTranslations("notifications.push");
  const { status, isLoading, enable, isEnabling } = usePushSubscription();
  const [hidden, setHidden] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHidden(isDismissedRecently());
  }, []);

  if (hidden || isLoading) {
    return null;
  }

  if (status !== "prompt" && status !== "unsubscribed") {
    return null;
  }

  return (
    <Alert className="rounded-none border-x-0 border-t-0">
      <BellRing />
      <AlertTitle>{t("optInTitle")}</AlertTitle>
      <AlertDescription>
        <p>{t("optInDescription")}</p>
        {error ? <p className="text-destructive">{error}</p> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={isEnabling}
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
            {isEnabling ? t("enabling") : t("enable")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isEnabling}
            onClick={() => {
              markDismissed();
              setHidden(true);
            }}
          >
            {t("notNow")}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

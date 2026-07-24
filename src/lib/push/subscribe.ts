import { publicEnv } from "@/config/env";

/**
 * Push subscription helpers (stubs).
 * No subscription persistence or push sending in Milestone 0.
 */

export function getVapidPublicKey(): string | null {
  return publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  const vapidKey = getVapidPublicKey();

  if (!vapidKey || !isPushSupported()) {
    return null;
  }

  throw new Error(
    "Push subscription is not implemented in Milestone 0. Service worker and push delivery come later.",
  );
}

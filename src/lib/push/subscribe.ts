import { publicEnv } from "@/config/env";
import {
  getNotificationPermission,
  requestNotificationPermission,
} from "@/lib/push/permissions";

export type PushSubscriptionStatus =
  | "unsupported"
  | "denied"
  | "prompt"
  | "subscribed"
  | "unsubscribed";

export function getVapidPublicKey(): string | null {
  return publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Convert a URL-safe base64 VAPID public key to a Uint8Array. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!isPushSupported()) {
    throw new Error("Push is not supported in this browser.");
  }
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

async function getReadyRegistration(): Promise<ServiceWorkerRegistration> {
  await registerPushServiceWorker();
  return navigator.serviceWorker.ready;
}

export async function getBrowserPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    return null;
  }
  const registration = await getReadyRegistration();
  return registration.pushManager.getSubscription();
}

export async function getPushSubscriptionStatus(): Promise<PushSubscriptionStatus> {
  if (!isPushSupported() || !getVapidPublicKey()) {
    return "unsupported";
  }

  const permission = getNotificationPermission();
  if (permission === "unsupported") {
    return "unsupported";
  }
  if (permission === "denied") {
    return "denied";
  }

  const existing = await getBrowserPushSubscription();
  if (existing) {
    return "subscribed";
  }

  if (permission === "default") {
    return "prompt";
  }

  return "unsubscribed";
}

async function persistSubscription(
  subscription: PushSubscription,
): Promise<void> {
  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error("Incomplete push subscription keys.");
  }

  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint,
      p256dh,
      auth,
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      payload?.error?.message ?? "Failed to save push subscription.",
    );
  }
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  const vapidKey = getVapidPublicKey();
  if (!vapidKey || !isPushSupported()) {
    return null;
  }

  const permission = await requestNotificationPermission();
  if (permission !== "granted") {
    return null;
  }

  const registration = await getReadyRegistration();
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });
  }

  await persistSubscription(subscription);
  return subscription;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) {
    return;
  }

  const registration = await getReadyRegistration();
  const subscription = await registration.pushManager.getSubscription();
  const endpoint = subscription?.endpoint;

  if (subscription) {
    await subscription.unsubscribe();
  }

  const response = await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(endpoint ? { endpoint } : {}),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      payload?.error?.message ?? "Failed to remove push subscription.",
    );
  }
}

/** Exported for tests — converts PushSubscription keys for API payloads. */
export function pushSubscriptionKeysToBase64Url(subscription: {
  getKey: (name: "p256dh" | "auth") => ArrayBuffer | null;
}): { p256dh: string; auth: string } | null {
  const p256dhKey = subscription.getKey("p256dh");
  const authKey = subscription.getKey("auth");
  if (!p256dhKey || !authKey) {
    return null;
  }
  return {
    p256dh: arrayBufferToBase64Url(p256dhKey),
    auth: arrayBufferToBase64Url(authKey),
  };
}

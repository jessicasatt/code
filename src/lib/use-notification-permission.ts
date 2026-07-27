"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  // Notification.permission has no native change event; nothing to
  // subscribe to. The explicit requestNotifications() call sites update
  // their own local state after requesting permission instead.
  return () => {};
}

function getSnapshot(): NotificationPermission | "unsupported" {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";
}

function getServerSnapshot(): NotificationPermission | "unsupported" {
  return "unsupported";
}

/** SSR-safe read of the browser's current Notification permission, via useSyncExternalStore rather than an effect + setState. */
export function useNotificationPermission(): NotificationPermission | "unsupported" {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

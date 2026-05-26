import webPush from "web-push";
import { prisma } from "@/lib/prisma";
import { notificationPayload } from "@/lib/notification-utils";

let configured = false;

export function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY ?? "";
}

export function isWebPushConfigured() {
  return Boolean(getVapidPublicKey() && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

export function configureWebPush() {
  if (configured) return;

  const publicKey = getVapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!isWebPushConfigured() || !publicKey || !privateKey || !subject) {
    throw new Error("VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT are required.");
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export async function sendPushNotification({
  subscriptionId,
  endpoint,
  p256dh,
  auth,
  title,
  body,
  url = "/calendar",
}: {
  subscriptionId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  title: string;
  body: string;
  url?: string;
}) {
  configureWebPush();

  try {
    await webPush.sendNotification(
      {
        endpoint,
        keys: { p256dh, auth },
      },
      notificationPayload(title, body, url),
    );
    return { ok: true };
  } catch (error) {
    const statusCode =
      typeof error === "object" && error && "statusCode" in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : 0;
    if (statusCode === 404 || statusCode === 410) {
      await prisma.pushSubscription.update({
        where: { id: subscriptionId },
        data: { revokedAt: new Date() },
      });
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Push delivery failed.",
      statusCode,
    };
  }
}

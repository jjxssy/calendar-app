import { ApiError, fail, ok, requireUser } from "@/lib/api-helpers";
import { isQuietTime, preferenceAllowsNotification } from "@/lib/notification-utils";
import { prisma } from "@/lib/prisma";
import { sendPushNotification } from "@/lib/web-push";

export async function POST() {
  try {
    const user = await requireUser();
    const preference = await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: user.id, revokedAt: null },
    });

    if (subscriptions.length === 0) {
      throw new ApiError("This device is not subscribed to Web Push yet.", 400);
    }

    const skippedForQuietHours = isQuietTime(preference);
    if (skippedForQuietHours) {
      return ok({
        sent: 0,
        skippedForQuietHours: true,
        message: "Quiet hours are active, so Arcgenda did not send the test notification.",
      });
    }

    const results = await Promise.all(
      subscriptions
        .filter((subscription) =>
          preferenceAllowsNotification(preference, "test", subscription.userAgent ?? ""),
        )
        .map((subscription) =>
          sendPushNotification({
            subscriptionId: subscription.id,
            endpoint: subscription.endpoint,
            p256dh: subscription.p256dh,
            auth: subscription.auth,
            title: "Arcgenda test notification",
            body: "Your browser push subscription is working on this device.",
          }),
        ),
    );

    const sent = results.filter((result) => result.ok).length;
    return ok({
      sent,
      failed: results.length - sent,
      message: sent > 0 ? "Test notification sent." : "No test notification could be delivered.",
    });
  } catch (error) {
    return fail(error);
  }
}

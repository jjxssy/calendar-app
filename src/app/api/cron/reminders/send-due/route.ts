import { fail, ok } from "@/lib/api-helpers";
import { isQuietTime, preferenceAllowsNotification, type NotificationKind } from "@/lib/notification-utils";
import { prisma } from "@/lib/prisma";
import { isWebPushConfigured, sendPushNotification } from "@/lib/web-push";

export const runtime = "nodejs";

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function sendToUserDevices({
  userId,
  kind,
  title,
  body,
}: {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
}) {
  const preference = await prisma.notificationPreference.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  if (isQuietTime(preference)) return { sent: 0, skipped: "quiet-hours" };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId, revokedAt: null },
  });
  const eligible = subscriptions.filter((subscription) =>
    preferenceAllowsNotification(preference, kind, subscription.userAgent ?? ""),
  );

  const results = await Promise.all(
    eligible.map((subscription) =>
      sendPushNotification({
        subscriptionId: subscription.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        title,
        body,
      }),
    ),
  );

  return { sent: results.filter((result) => result.ok).length, skipped: "" };
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return Response.json({ error: "Unauthorized cron request." }, { status: 401 });
    }
    if (!isWebPushConfigured()) {
      return ok({
        sent: 0,
        remindersChecked: 0,
        skippedQuietHours: 0,
        skippedDuplicates: 0,
        note: "Closed-app push notifications are not configured yet. Add VAPID keys before enabling cron delivery.",
      });
    }

    const now = new Date();
    const reminderGraceStart = addMinutes(now, -10);
    const reminderGraceEnd = addMinutes(now, 0.5);
    const taskGraceStart = addMinutes(now, -10);
    const taskGraceEnd = addMinutes(now, 0.5);
    let sent = 0;
    let skippedQuietHours = 0;
    let skippedDuplicates = 0;

    await prisma.reminder.updateMany({
      where: {
        completed: false,
        notificationSentAt: null,
        remindAt: { lt: reminderGraceStart },
      },
      data: { notificationSentAt: now },
    });

    const reminders = await prisma.reminder.findMany({
      where: {
        completed: false,
        notificationSentAt: null,
        remindAt: { gte: reminderGraceStart, lte: reminderGraceEnd },
        user: { pushSubscriptions: { some: { revokedAt: null } } },
      },
      take: 100,
      orderBy: { remindAt: "asc" },
    });

    for (const reminder of reminders) {
      const key = `reminder:${reminder.id}`;
      const delivery = await prisma.notificationDelivery
        .create({
          data: {
            userId: reminder.userId,
            reminderId: reminder.id,
            eventId: reminder.eventId,
            taskId: reminder.taskId,
            type: reminder.taskId ? "task" : "event",
            key,
          },
        })
        .catch(() => null);
      if (!delivery) {
        skippedDuplicates += 1;
        continue;
      }

      const result = await sendToUserDevices({
        userId: reminder.userId,
        kind: reminder.taskId ? "task" : "event",
        title: "Arcgenda reminder",
        body: reminder.title,
      });
      if (result.skipped === "quiet-hours") skippedQuietHours += 1;
      sent += result.sent;
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { notificationSentAt: now },
      });
    }

    const preferences = await prisma.notificationPreference.findMany({
      where: {
        OR: [{ eventReminders: true }, { taskReminders: true }, { dailyAgenda: true }],
        user: { pushSubscriptions: { some: { revokedAt: null } } },
      },
    });

    for (const preference of preferences) {
      if (isQuietTime(preference, now)) {
        skippedQuietHours += 1;
        continue;
      }

      if (preference.eventReminders) {
        const events = await prisma.event.findMany({
          where: {
            userId: preference.userId,
            status: "scheduled",
            startDate: {
              gte: addMinutes(now, preference.defaultReminderMinutes - 2),
              lte: addMinutes(now, preference.defaultReminderMinutes + 2),
            },
          },
          take: 25,
          orderBy: { startDate: "asc" },
        });

        for (const event of events) {
          const key = `event-default:${event.id}:${preference.defaultReminderMinutes}`;
          const delivery = await prisma.notificationDelivery
            .create({
              data: {
                userId: preference.userId,
                eventId: event.id,
                type: "event",
                key,
              },
            })
            .catch(() => null);
          if (!delivery) {
            skippedDuplicates += 1;
            continue;
          }
          const result = await sendToUserDevices({
            userId: preference.userId,
            kind: "event",
            title: "Upcoming event",
            body: `${event.title} starts soon.`,
          });
          sent += result.sent;
        }
      }

      if (preference.taskReminders) {
        const tasks = await prisma.task.findMany({
          where: {
            userId: preference.userId,
            completed: false,
            dueDate: { gte: taskGraceStart, lte: taskGraceEnd },
          },
          take: 50,
          orderBy: { dueDate: "asc" },
        });

        for (const task of tasks) {
          const key = `task:${task.id}`;
          const delivery = await prisma.notificationDelivery
            .create({
              data: {
                userId: preference.userId,
                taskId: task.id,
                type: "task",
                key,
              },
            })
            .catch(() => null);
          if (!delivery) {
            skippedDuplicates += 1;
            continue;
          }
          const result = await sendToUserDevices({
            userId: preference.userId,
            kind: "task",
            title: "Task reminder",
            body: task.title,
          });
          sent += result.sent;
        }
      }
    }

    return ok({
      sent,
      remindersChecked: reminders.length,
      skippedQuietHours,
      skippedDuplicates,
      note: "Configure Vercel Cron or another scheduler to call this route regularly.",
    });
  } catch (error) {
    return fail(error);
  }
}

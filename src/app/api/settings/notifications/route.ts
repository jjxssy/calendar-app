import { booleanValue, numberValue, fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireUser();
    const preferences = await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });

    return ok({ preferences });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await readBody(request);
    const data = {
      eventReminders: booleanValue(body.eventReminders),
      taskReminders: booleanValue(body.taskReminders),
      dailyAgenda: booleanValue(body.dailyAgenda),
      rescheduleReminders: booleanValue(body.rescheduleReminders),
      birthdayReminders: booleanValue(body.birthdayReminders),
      desktopNotifications: booleanValue(body.desktopNotifications),
      mobileNotifications: booleanValue(body.mobileNotifications),
      quietHoursEnabled: booleanValue(body.quietHoursEnabled),
      quietHoursStart: stringValue(body.quietHoursStart),
      quietHoursEnd: stringValue(body.quietHoursEnd),
      soundEnabled: booleanValue(body.soundEnabled),
      vibrationEnabled: booleanValue(body.vibrationEnabled),
      defaultReminderMinutes: numberValue(body.defaultReminderMinutes, "defaultReminderMinutes"),
      aiEnabled: booleanValue(body.aiEnabled),
      aiScheduling: booleanValue(body.aiScheduling),
      aiInsights: booleanValue(body.aiInsights),
      aiWeeklySummary: booleanValue(body.aiWeeklySummary),
      privateMode: booleanValue(body.privateMode),
    };
    const preferences = await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      update: data,
      create: { userId: user.id, ...data },
    });

    return ok({ preferences });
  } catch (error) {
    return fail(error);
  }
}

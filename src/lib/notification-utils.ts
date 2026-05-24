import type { NotificationPreferenceModel } from "@/generated/prisma/models";

export type NotificationKind =
  | "event"
  | "task"
  | "daily-agenda"
  | "reschedule"
  | "birthday"
  | "test";

export function isQuietTime(
  preference: Pick<NotificationPreferenceModel, "quietHoursEnabled" | "quietHoursStart" | "quietHoursEnd">,
  now = new Date(),
) {
  if (!preference.quietHoursEnabled) return false;

  const [startHour = 22, startMinute = 0] = preference.quietHoursStart.split(":").map(Number);
  const [endHour = 7, endMinute = 0] = preference.quietHoursEnd.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const current = now.getHours() * 60 + now.getMinutes();

  if (start === end) return false;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export function preferenceAllowsNotification(
  preference: NotificationPreferenceModel,
  kind: NotificationKind,
  userAgent = "",
) {
  if (kind === "test") return true;
  const mobileDevice = /android|iphone|ipad|ipod|mobile/i.test(userAgent);
  if (mobileDevice && !preference.mobileNotifications) return false;
  if (!mobileDevice && !preference.desktopNotifications) return false;

  switch (kind) {
    case "event":
      return preference.eventReminders;
    case "task":
      return preference.taskReminders;
    case "daily-agenda":
      return preference.dailyAgenda;
    case "reschedule":
      return preference.rescheduleReminders;
    case "birthday":
      return preference.birthdayReminders;
    default:
      return false;
  }
}

export function notificationPayload(title: string, body: string, url = "/calendar") {
  return JSON.stringify({
    title,
    options: {
      body,
      icon: "/icons/arcgenda-icon-192.png",
      badge: "/icons/arcgenda-icon-192.png",
      data: { url },
    },
  });
}

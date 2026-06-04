import { CalendarEvent, CategoryStyle } from "./events";

export type AppCalendar = {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  shared: boolean;
  role: "owner" | "editor" | "viewer";
  members: Array<{
    id: string;
    userId?: string | null;
    email: string;
    displayName?: string;
    role: "owner" | "editor" | "viewer";
    status: "pending" | "accepted";
  }>;
};

export type NotificationSettings = {
  eventReminders: boolean;
  taskReminders: boolean;
  dailyAgenda: boolean;
  rescheduleReminders: boolean;
  birthdayReminders: boolean;
  desktopNotifications: boolean;
  mobileNotifications: boolean;
  quietHours: boolean;
  quietStart: string;
  quietEnd: string;
  sound: boolean;
  vibration: boolean;
  defaultTiming: string;
};

export type AiSettings = {
  enabled: boolean;
  scheduling: boolean;
  insights: boolean;
  reschedule: boolean;
  weeklySummary: boolean;
  privateMode: boolean;
};

export type AppSettings = {
  theme: "system" | "light" | "dark";
  skipIntro: boolean;
  profile: {
    accountName: string;
    calendarDisplayNames: Record<string, string>;
  };
  notifications: NotificationSettings;
  ai: AiSettings;
};

export type CalendarStats = {
  totalEvents: number;
  completedEvents: number;
  cancelledEvents: number;
  upcomingEvents: number;
  taskCompletionRate: number;
  mostUsedCategory: string;
  mostActiveDay: string;
  weeklySummary: string;
  monthlySummary: string;
};

export const defaultSettings: AppSettings = {
  theme: "system",
  skipIntro: false,
  profile: {
    accountName: "",
    calendarDisplayNames: {},
  },
  notifications: {
    eventReminders: true,
    taskReminders: true,
    dailyAgenda: false,
    rescheduleReminders: true,
    birthdayReminders: false,
    desktopNotifications: false,
    mobileNotifications: false,
    quietHours: true,
    quietStart: "22:00",
    quietEnd: "07:00",
    sound: false,
    vibration: true,
    defaultTiming: "15 minutes before",
  },
  ai: {
    enabled: false,
    scheduling: false,
    insights: false,
    reschedule: false,
    weeklySummary: false,
    privateMode: true,
  },
};

export function computeStats(
  events: CalendarEvent[],
  tasks: Array<{ done: boolean }>,
  tags: CategoryStyle[],
): CalendarStats {
  const nowKey = new Date().toISOString().slice(0, 10);
  const totalEvents = events.filter((event) => event.status !== "archived").length;
  const completedEvents = events.filter((event) => event.status === "completed").length;
  const cancelledEvents = events.filter((event) => event.status === "cancelled").length;
  const upcomingEvents = events.filter(
    (event) => event.status === "scheduled" && event.date >= nowKey,
  ).length;
  const completedTasks = tasks.filter((task) => task.done).length;
  const taskCompletionRate = tasks.length
    ? Math.round((completedTasks / tasks.length) * 100)
    : 0;
  const categoryCounts = events.reduce<Record<string, number>>((counts, event) => {
    counts[event.category] = (counts[event.category] ?? 0) + 1;
    return counts;
  }, {});
  const mostUsedCategoryId =
    Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "none";
  const mostUsedCategory =
    tags.find((tag) => tag.id === mostUsedCategoryId)?.label ?? "No category yet";
  const dayCounts = events.reduce<Record<string, number>>((counts, event) => {
    const day = new Date(`${event.date}T12:00`).toLocaleDateString("en", {
      weekday: "long",
    });
    counts[day] = (counts[day] ?? 0) + 1;
    return counts;
  }, {});
  const mostActiveDay =
    Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "No pattern yet";

  return {
    totalEvents,
    completedEvents,
    cancelledEvents,
    upcomingEvents,
    taskCompletionRate,
    mostUsedCategory,
    mostActiveDay,
    weeklySummary: `${upcomingEvents} upcoming events and ${tasks.length - completedTasks} open tasks are on deck.`,
    monthlySummary: `${totalEvents} events planned, ${cancelledEvents} cancelled, ${taskCompletionRate}% task completion.`,
  };
}

export function buildAiSuggestions(stats: CalendarStats, events: CalendarEvent[]) {
  const cancelled = events.filter((event) => event.status === "cancelled");
  return [
    stats.upcomingEvents === 0
      ? "Your week looks open. Try blocking one focus session before it fills up."
      : "Protect your busiest day with one no-meeting block.",
    stats.taskCompletionRate < 50
      ? "A shorter checklist may help. Move one low-priority task to tomorrow."
      : "Task momentum looks good. Keep reminders lightweight.",
    cancelled[0]
      ? `Reschedule suggestion: create a follow-up for "${cancelled[0].title}" tomorrow morning.`
      : "No cancelled events need rescheduling right now.",
    `Weekly summary: ${stats.weeklySummary}`,
  ];
}

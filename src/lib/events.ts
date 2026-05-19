import { toDateKey } from "./calendar";

export type EventCategory = string;
export type EventPriority = "low" | "normal" | "high";
export type Recurrence = "none" | "daily" | "weekly" | "monthly" | "yearly";
export type EventStatus = "scheduled" | "completed" | "cancelled" | "archived";

export type RescheduleReminder = {
  id: string;
  eventId: string;
  title: string;
  date: string;
  time: string;
  done: boolean;
};

export type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  category: EventCategory;
  priority: EventPriority;
  recurrence: Recurrence;
  location: string;
  notes: string;
  allDay: boolean;
  pinned: boolean;
  status: EventStatus;
  cancellationReason?: string;
  cancelledAt?: string;
  rescheduleReminders: RescheduleReminder[];
  tasks: Array<{ id: string; title: string; done: boolean }>;
};

export type CategoryStyle = {
  id: string;
  label: string;
  icon: string;
  color: string;
  tint: string;
};

export const categoryStyles: Record<string, CategoryStyle> = {
  work: {
    id: "work",
    label: "Work",
    icon: "briefcase",
    color: "#007aff",
    tint: "#e5f1ff",
  },
  personal: {
    id: "personal",
    label: "Personal",
    icon: "heart",
    color: "#ff2d55",
    tint: "#ffe8ef",
  },
  health: {
    id: "health",
    label: "Health",
    icon: "activity",
    color: "#34c759",
    tint: "#e8f9ee",
  },
  creative: {
    id: "creative",
    label: "Creative",
    icon: "palette",
    color: "#af52de",
    tint: "#f7eaff",
  },
};

export function createInitialEvents(today = new Date()): CalendarEvent[] {
  const todayKey = toDateKey(today);
  const tomorrowKey = toDateKey(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
  );
  const laterKey = toDateKey(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + 4),
  );

  return [
    {
      id: "evt-1",
      title: "Design review",
      date: todayKey,
      time: "09:30",
      duration: "45m",
      category: "work",
      priority: "high",
      recurrence: "weekly",
      location: "Product room",
      notes: "Review month, week, and day view interactions.",
      allDay: false,
      pinned: true,
      status: "scheduled",
      rescheduleReminders: [],
      tasks: [
        { id: "task-1", title: "Export Figma notes", done: true },
        { id: "task-2", title: "Check empty states", done: false },
      ],
    },
    {
      id: "evt-2",
      title: "Morning walk",
      date: todayKey,
      time: "11:00",
      duration: "30m",
      category: "health",
      priority: "normal",
      recurrence: "daily",
      location: "Park loop",
      notes: "Habit streak support starts here.",
      allDay: false,
      pinned: false,
      status: "scheduled",
      rescheduleReminders: [],
      tasks: [{ id: "task-3", title: "Log habit", done: false }],
    },
    {
      id: "evt-3",
      title: "Lunch with Maya",
      date: todayKey,
      time: "13:15",
      duration: "1h",
      category: "personal",
      priority: "normal",
      recurrence: "none",
      location: "Market street",
      notes: "Birthday reminder follow-up.",
      allDay: false,
      pinned: false,
      status: "scheduled",
      rescheduleReminders: [],
      tasks: [],
    },
    {
      id: "evt-4",
      title: "Sketch calendar icons",
      date: tomorrowKey,
      time: "16:00",
      duration: "50m",
      category: "creative",
      priority: "low",
      recurrence: "none",
      location: "Studio",
      notes: "Color category icons for backend metadata.",
      allDay: false,
      pinned: false,
      status: "scheduled",
      rescheduleReminders: [],
      tasks: [{ id: "task-4", title: "Pick icon set", done: false }],
    },
    {
      id: "evt-5",
      title: "Release planning",
      date: laterKey,
      time: "All day",
      duration: "1d",
      category: "work",
      priority: "high",
      recurrence: "monthly",
      location: "Remote",
      notes: "Pinned roadmap event.",
      allDay: true,
      pinned: true,
      status: "scheduled",
      rescheduleReminders: [],
      tasks: [],
    },
  ];
}

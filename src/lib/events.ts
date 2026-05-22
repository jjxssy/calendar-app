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
  void today;
  return [];
}

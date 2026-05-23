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
  calendarId?: string;
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
  createdBy?: string;
  lastEditedBy?: string;
  sharedWith?: Array<{ id: string; email: string; role: "editor" | "viewer"; status: "pending" | "accepted" }>;
  activity?: Array<{ id: string; text: string; at: string }>;
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
  hobby: {
    id: "hobby",
    label: "Hobby",
    icon: "sparkles",
    color: "#af52de",
    tint: "#f7eaff",
  },
  health: {
    id: "health",
    label: "Health",
    icon: "activity",
    color: "#34c759",
    tint: "#e8f9ee",
  },
  study: {
    id: "study",
    label: "Study",
    icon: "book",
    color: "#5856d6",
    tint: "#ededff",
  },
  errands: {
    id: "errands",
    label: "Errands",
    icon: "check",
    color: "#ff9500",
    tint: "#fff2df",
  },
  social: {
    id: "social",
    label: "Social",
    icon: "users",
    color: "#ff2d55",
    tint: "#ffe8ef",
  },
  fitness: {
    id: "fitness",
    label: "Fitness",
    icon: "heart",
    color: "#00c7be",
    tint: "#e4fbf9",
  },
  important: {
    id: "important",
    label: "Important",
    icon: "pin",
    color: "#ff3b30",
    tint: "#ffe8e6",
  },
  creative: {
    id: "creative",
    label: "Creative",
    icon: "palette",
    color: "#5ac8fa",
    tint: "#e7f8ff",
  },
};

export function createInitialEvents(today = new Date()): CalendarEvent[] {
  void today;
  return [];
}

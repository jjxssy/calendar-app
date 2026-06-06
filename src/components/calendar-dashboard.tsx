"use client";

import {
  Bell,
  BellRing,
  Brain,
  CalendarDays,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  CircleX,
  Clock3,
  Edit3,
  ListChecks,
  MapPin,
  Palette,
  Pin,
  RotateCcw,
  Search,
  Share2,
  Shield,
  Sparkles,
  Smartphone,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AppSession,
  clearSession,
  logout,
  readSession,
  saveSession,
} from "@/lib/api";
import { createClient } from "@/utils/supabase/client";

import {
  CalendarView,
  addDays,
  formatLongDate,
  formatMonthYear,
  fromDateKey,
  getMonthDays,
  getWeekDays,
  sameDate,
  startOfMonth,
  toDateKey,
} from "@/lib/calendar";
import {
  CalendarEvent,
  CategoryStyle,
  Recurrence,
  RescheduleReminder,
  categoryStyles,
  createInitialEvents,
} from "@/lib/events";
import {
  AiSettings,
  AppCalendar,
  AppSettings,
  buildAiSuggestions,
  computeStats,
  defaultSettings,
  NotificationSettings,
} from "@/lib/free-tier";
import { BrandMark } from "@/components/brand/brand-mark";

type AppTab = "calendar" | "tasks" | "alerts" | "stats" | "settings";
type ComposerKind = "event" | "task";
type TaskView = "day" | "week" | "month";
type StatsRange = "daily" | "monthly" | "yearly";
type ReminderPreset = "5m" | "10m" | "30m" | "1h" | "1d" | "custom";
type CancelScope = "series-cancel" | "series-delete";

type SettingsSectionId =
  | "profile"
  | "calendars"
  | "notifications"
  | "theme"
  | "ai"
  | "sync"
  | "danger";

type EventDraft = Pick<
  CalendarEvent,
  | "calendarId"
  | "title"
  | "date"
  | "time"
  | "duration"
  | "category"
  | "recurrence"
  | "location"
  | "notes"
  | "allDay"
  | "pinned"
>;

type ReminderDraft = {
  enabled: boolean;
  preset: ReminderPreset;
  date: string;
  time: string;
};

type TagDraft = {
  label: string;
  icon: string;
  color: string;
};

type StandaloneTask = {
  id: string;
  title: string;
  done: boolean;
  date?: string;
  time?: string;
  reminderDate?: string;
  reminderTime?: string;
  eventId: string | null;
  eventTitle: string;
  notificationSentAt?: string | null;
};

type TaskDraft = {
  title: string;
  reminderEnabled: boolean;
  reminderDate: string;
  reminderTime: string;
  eventId: string;
};

type TaskListItem = {
  id: string;
  title: string;
  done: boolean;
  eventId: string | null;
  eventTitle: string;
  eventStatus?: CalendarEvent["status"];
  date: string;
  time?: string;
};

type CalendarData = {
  tags: CategoryStyle[];
  calendars: AppCalendar[];
  events: CalendarEvent[];
  standaloneTasks: StandaloneTask[];
  eventReminders: RescheduleReminder[];
  settings: AppSettings;
};

type NotificationCapabilities = {
  supportsNotifications: boolean;
  supportsServiceWorker: boolean;
  supportsPush: boolean;
  supportsVibration: boolean;
  isIOS: boolean;
  isPWAInstalled: boolean;
};

type DbMember = {
  id: string;
  email: string;
  user?: { id: string; name?: string | null; email: string } | null;
  displayName?: string | null;
  role: "owner" | "editor" | "viewer";
  status: "pending" | "accepted" | "declined";
  userId?: string | null;
};

type DbCalendar = {
  id: string;
  ownerId: string;
  name: string;
  color: string;
  visible: boolean;
  shared: boolean;
  members: DbMember[];
};

type CalendarInvitation = {
  id: string;
  email: string;
  role: "owner" | "editor" | "viewer";
  status: "pending";
  calendar: DbCalendar & {
    owner?: { id: string; email: string; name?: string | null } | null;
  };
};

type DbCategory = {
  id: string;
  name: string;
  color: string;
  icon?: string | null;
};

type DbReminder = {
  id: string;
  eventId?: string | null;
  taskId?: string | null;
  title: string;
  remindAt: string;
  completed: boolean;
  notificationSentAt?: string | null;
};

type DbTask = {
  id: string;
  eventId?: string | null;
  title: string;
  description?: string | null;
  completed: boolean;
  dueDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  event?: {
    id: string;
    title: string;
    status?: CalendarEvent["status"];
    startDate?: string;
  } | null;
  reminders?: DbReminder[];
};

type DbEvent = {
  id: string;
  calendarId?: string | null;
  categoryId?: string | null;
  createdById?: string | null;
  updatedById?: string | null;
  createdBy?: { id: string; name?: string | null; email: string } | null;
  updatedBy?: { id: string; name?: string | null; email: string } | null;
  title: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  allDay: boolean;
  color?: string | null;
  location?: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  recurrence?: Recurrence | null;
  pinned: boolean;
  status: CalendarEvent["status"];
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  calendar?: DbCalendar | null;
  category?: DbCategory | null;
  tasks: DbTask[];
  reminders: DbReminder[];
  shares?: Array<{
    id: string;
    email: string;
    role: "editor" | "viewer";
    status: "pending" | "accepted";
  }>;
};

type DbNotificationPreferences = {
  eventReminders: boolean;
  taskReminders: boolean;
  dailyAgenda: boolean;
  rescheduleReminders: boolean;
  birthdayReminders: boolean;
  desktopNotifications: boolean;
  mobileNotifications: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  defaultReminderMinutes: number;
  aiEnabled: boolean;
  aiScheduling: boolean;
  aiInsights: boolean;
  aiWeeklySummary: boolean;
  privateMode: boolean;
};

type ToastTone = "success" | "error" | "info" | "warning";

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
  visible: boolean;
};

const viewOptions: CalendarView[] = ["month", "week", "day"];
const taskViewOptions: TaskView[] = ["day", "week", "month"];
const recurrences: Recurrence[] = [
  "none",
  "daily",
  "weekly",
  "monthly",
  "yearly",
];
const reminderPresets: Array<{
  value: ReminderPreset;
  label: string;
  minutes?: number;
}> = [
  { value: "5m", label: "5 min before", minutes: 5 },
  { value: "10m", label: "10 min before", minutes: 10 },
  { value: "30m", label: "30 min before", minutes: 30 },
  { value: "1h", label: "1 hour before", minutes: 60 },
  { value: "1d", label: "1 day before", minutes: 1440 },
  { value: "custom", label: "Custom" },
];
const timelineSlots = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];
const settingsNavigation: Array<{ id: SettingsSectionId; label: string }> = [
  { id: "profile", label: "Profile" },
  { id: "calendars", label: "Calendars" },
  { id: "notifications", label: "Notifications" },
  { id: "theme", label: "Theme" },
  { id: "ai", label: "AI & Privacy" },
  { id: "sync", label: "Sync & Export" },
  { id: "danger", label: "Danger" },
];
const colorGrid = [
  "#007aff",
  "#34c759",
  "#ff9500",
  "#ff2d55",
  "#af52de",
  "#5ac8fa",
  "#5856d6",
  "#ffcc00",
  "#ff6b6b",
  "#00c7be",
  "#8e8e93",
  "#1d1d1f",
];

let serviceWorkerRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null =
  null;

function createId() {
  return (
    globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random()}`
  );
}

function currentTimeValue(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function dateKeyFromDbDate(value: string) {
  return value.slice(0, 10);
}

function timeValueFromDbDate(value: string) {
  const match = value.match(/T?(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : currentTimeValue(new Date(value));
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    return Notification.requestPermission();
  }
  return Promise.resolve(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  serviceWorkerRegistrationPromise ??= navigator.serviceWorker
    .register("/sw.js")
    .then(() => navigator.serviceWorker.ready)
    .catch(() => null);
  return serviceWorkerRegistrationPromise;
}

async function showArcgendaNotification(body: string, vibrate: boolean) {
  if (!("Notification" in window) || Notification.permission !== "granted")
    return false;

  const options: NotificationOptions = {
    body,
    icon: "/icons/arcgenda-icon-192.png",
    badge: "/icons/arcgenda-icon-192.png",
    data: { url: "/calendar" },
  };

  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification("Arcgenda", options);
  } else {
    new Notification("Arcgenda", options);
  }

  if (vibrate && canVibrateDevice()) navigator.vibrate(120);
  return true;
}

function readCalendarData(today: Date): CalendarData {
  const fallback = {
    tags: Object.values(categoryStyles),
    calendars: [],
    events: createInitialEvents(today),
    standaloneTasks: [],
    eventReminders: [],
    settings: { ...defaultSettings },
  };

  return fallback;
}

function normalizeTheme(value: unknown): AppSettings["theme"] {
  if (value === "light" || value === "dark" || value === "system") return value;
  if (value === "white") return "light";
  return "system";
}

const THEME_STORAGE_KEY = "arcgenda-theme";

function applyDocumentTheme(theme: AppSettings["theme"], cache = true) {
  if (typeof window === "undefined") return;

  const normalizedTheme = normalizeTheme(theme);
  const root = document.documentElement;
  const systemDark =
    window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  const dark =
    normalizedTheme === "dark" || (normalizedTheme === "system" && systemDark);

  root.dataset.theme = normalizedTheme;
  root.classList.toggle("dark", dark);

  if (cache) {
    window.localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
  }
}

async function apiJson<T>(url: string, init?: RequestInit) {
  const token =
    typeof window === "undefined"
      ? undefined
      : ((await createClient().auth.getSession()).data.session?.access_token ??
        readSession()?.accessToken);

  const method = init?.method?.toUpperCase() ?? "GET";
  const requestUrl =
    method === "GET"
      ? `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`
      : url;

  const response = await fetch(requestUrl, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload as T;
}

function mapCalendar(
  calendar: DbCalendar,
  session: AppSession | null,
): AppCalendar {
  const ownMember = calendar.members.find(
    (member) => member.userId === session?.user.id,
  );
  return {
    id: calendar.id,
    name: calendar.name,
    color: calendar.color,
    visible: calendar.visible,
    shared: calendar.shared || calendar.members.length > 1,
    role:
      calendar.ownerId === session?.user.id
        ? "owner"
        : (ownMember?.role ?? "viewer"),
    members: calendar.members.map((member) => ({
      id: member.id,
      userId: member.userId,
      email: member.email,
      displayName: member.displayName ?? undefined,
      role: member.role,
      status: member.status,
    })),
  };
}

function mapCategory(category: DbCategory): CategoryStyle {
  return {
    id: category.id,
    label: category.name,
    icon: category.icon ?? "tag",
    color: category.color,
    tint: tintFromColor(category.color),
  };
}

function displayNameForUser(
  user:
    | { id?: string | null; name?: string | null; email?: string | null }
    | null
    | undefined,
  calendar?: DbCalendar | null,
) {
  if (!user?.id) return "Unknown user";
  const memberName = calendar?.members.find(
    (member) => member.userId === user.id,
  )?.displayName;
  return memberName || user.name || user.email || "Unknown user";
}

function formatDuration(startDate: string, endDate?: string | null) {
  if (!endDate) return "30m";
  const minutes = Math.max(
    15,
    Math.round(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / 60000,
    ),
  );
  return minutes >= 60 && minutes % 60 === 0
    ? `${minutes / 60}h`
    : `${minutes}m`;
}

function mapReminder(reminder: DbReminder): RescheduleReminder {
  return {
    id: reminder.id,
    eventId: reminder.eventId ?? "none",
    title: reminder.title,
    date: dateKeyFromDbDate(reminder.remindAt),
    time: timeValueFromDbDate(reminder.remindAt),
    done: reminder.completed,
    notificationSentAt: reminder.notificationSentAt ?? null,
  };
}

function mapEvent(event: DbEvent): CalendarEvent {
  const start = new Date(event.startDate);
  const eventDate = dateKeyFromDbDate(event.startDate);
  const eventTime = timeValueFromDbDate(event.startDate);
  return {
    id: event.id,
    calendarId: event.calendarId ?? undefined,
    title: event.title,
    date: eventDate,
    time: event.allDay ? "All day" : eventTime,
    duration: formatDuration(event.startDate, event.endDate),
    category: event.categoryId ?? event.category?.id ?? "uncategorized",
    priority: event.priority === "urgent" ? "high" : event.priority,
    recurrence: event.recurrence ?? "none",
    location: event.location ?? "No location",
    notes: event.description ?? "",
    allDay: event.allDay,
    pinned: event.pinned,
    status: event.status,
    cancellationReason: event.cancellationReason ?? undefined,
    cancelledAt: event.cancelledAt ?? undefined,
    createdBy: displayNameForUser(event.createdBy, event.calendar),
    lastEditedBy: displayNameForUser(event.updatedBy, event.calendar),
    sharedWith: event.shares?.map((share) => ({
      id: share.id,
      email: share.email,
      role: share.role,
      status: share.status,
    })),
    activity: [],
    rescheduleReminders: event.reminders.map(mapReminder),
    tasks: event.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      done: task.completed,
    })),
  };
}

function mapStandaloneTask(task: DbTask, today: Date): StandaloneTask {
  const firstReminder = task.reminders
    ?.filter((reminder) => !reminder.completed)
    .sort((a, b) => a.remindAt.localeCompare(b.remindAt))[0];

  const dateSource =
    task.dueDate ?? task.event?.startDate ?? task.createdAt ?? null;

  return {
    id: task.id,
    title: task.title,
    done: task.completed,
    date: dateSource ? dateKeyFromDbDate(dateSource) : toDateKey(today),
    time: dateSource ? timeValueFromDbDate(dateSource) : undefined,

    // Important:
    // reminderDate/reminderTime must come from real Reminder rows only.
    // dueDate is just the task's date/time, not automatically a notification.
    reminderDate: firstReminder
      ? dateKeyFromDbDate(firstReminder.remindAt)
      : undefined,
    reminderTime: firstReminder
      ? timeValueFromDbDate(firstReminder.remindAt)
      : undefined,

    eventId: task.eventId ?? null,
    eventTitle: task.event?.title ?? "Standalone task",
    notificationSentAt: firstReminder?.notificationSentAt ?? null,
  };
}

function mapPreferencesToSettings(
  preferences: DbNotificationPreferences,
  baseSettings: AppSettings,
  profile: AppSettings["profile"],
  theme: AppSettings["theme"],
  skipIntro: boolean,
): AppSettings {
  return {
    ...baseSettings,
    theme,
    skipIntro,
    profile,
    notifications: {
      eventReminders: preferences.eventReminders,
      taskReminders: preferences.taskReminders,
      dailyAgenda: preferences.dailyAgenda,
      rescheduleReminders: preferences.rescheduleReminders,
      birthdayReminders: preferences.birthdayReminders,
      desktopNotifications: preferences.desktopNotifications,
      mobileNotifications: preferences.mobileNotifications,
      quietHours: preferences.quietHoursEnabled,
      quietStart: preferences.quietHoursStart,
      quietEnd: preferences.quietHoursEnd,
      sound: preferences.soundEnabled,
      vibration: preferences.vibrationEnabled,
      defaultTiming:
        preferences.defaultReminderMinutes === 0
          ? "At time of event"
          : `${preferences.defaultReminderMinutes} minutes before`,
    },
    ai: {
      ...baseSettings.ai,
      enabled: preferences.aiEnabled,
      scheduling: preferences.aiScheduling,
      insights: preferences.aiInsights,
      weeklySummary: preferences.aiWeeklySummary,
      privateMode: preferences.privateMode,
    },
  };
}

function dateTimeFromDraft(date: string, time: string, allDay: boolean) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour = 9, minute = 0] = (allDay ? "00:00" : time || "09:00")
    .split(":")
    .map(Number);
  return new Date(year, month - 1, day, hour, minute, 0).toISOString();
}

function reminderDateTimeFromPreset(startDate: string, preset: ReminderPreset) {
  const presetConfig = reminderPresets.find((item) => item.value === preset);
  const reminderDate = new Date(startDate);
  reminderDate.setMinutes(
    reminderDate.getMinutes() - (presetConfig?.minutes ?? 10),
  );
  return {
    date: toDateKey(reminderDate),
    time: currentTimeValue(reminderDate),
  };
}

function resolveReminderDateTime(
  draft: ReminderDraft,
  startDate: string,
  recurrence: Recurrence,
) {
  if (!draft.enabled) return null;
  if (draft.preset === "custom") {
    if (recurrence !== "none") {
      throw new Error(
        "Custom reminders are only available for one-time events.",
      );
    }
    return { date: draft.date, time: draft.time };
  }
  return reminderDateTimeFromPreset(startDate, draft.preset);
}

function minutesFromDuration(duration: string) {
  if (duration.endsWith("h"))
    return Number(duration.replace("h", "")) * 60 || 60;
  return Number(duration.replace("m", "")) || 30;
}

function parseReminderMinutes(label: string) {
  if (label === "At time of event") return 0;
  if (label.includes("hour")) return 60;
  if (label.includes("day")) return 1440;
  return Number(label.match(/\d+/)?.[0] ?? 15);
}

function reminderDueAt(reminder: { date: string; time: string }) {
  return new Date(`${reminder.date}T${reminder.time}`);
}

function isReminderDueNow(
  reminder: { date: string; time: string },
  now = new Date(),
) {
  const due = reminderDueAt(reminder).getTime();
  const current = now.getTime();
  return due >= current - 2 * 60 * 1000 && due <= current + 30 * 1000;
}

function isReminderTooOld(
  reminder: { date: string; time: string },
  now = new Date(),
) {
  return reminderDueAt(reminder).getTime() < now.getTime() - 5 * 60 * 1000;
}

function isFutureDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`).getTime() > Date.now();
}

function isQuietTime(settings: NotificationSettings, now = new Date()) {
  if (!settings.quietHours) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  const [startHour = 22, startMinute = 0] = settings.quietStart
    .split(":")
    .map(Number);
  const [endHour = 7, endMinute = 0] = settings.quietEnd.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return start <= end
    ? current >= start && current <= end
    : current >= start || current <= end;
}

function deviceNotificationsEnabled(settings: NotificationSettings) {
  const mobileDevice = detectMobileDevice();
  return mobileDevice
    ? settings.mobileNotifications
    : settings.desktopNotifications;
}

function detectMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function canVibrateDevice() {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

function detectNotificationCapabilities(): NotificationCapabilities {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      supportsNotifications: false,
      supportsServiceWorker: false,
      supportsPush: false,
      supportsVibration: false,
      isIOS: false,
      isPWAInstalled: false,
    };
  }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  const isPWAInstalled =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    standaloneNavigator.standalone === true;
  const supportsNotifications = "Notification" in window;
  const supportsServiceWorker = "serviceWorker" in navigator;
  const supportsPush =
    supportsNotifications && supportsServiceWorker && "PushManager" in window;

  return {
    supportsNotifications,
    supportsServiceWorker,
    supportsPush,
    supportsVibration: canVibrateDevice(),
    isIOS,
    isPWAInstalled,
  };
}

function emptyDraft(date: Date, category: string): EventDraft {
  return {
    calendarId: "",
    title: "",
    date: toDateKey(date),
    time: currentTimeValue(),
    duration: "30m",
    category,
    recurrence: "none",
    location: "",
    notes: "",
    allDay: false,
    pinned: false,
  };
}

function eventToDraft(event: CalendarEvent): EventDraft {
  return {
    calendarId: event.calendarId ?? "",
    title: event.title,
    date: event.date,
    time: event.allDay ? "09:00" : event.time,
    duration: event.duration,
    category: event.category,
    recurrence: event.recurrence,
    location: event.location,
    notes: event.notes,
    allDay: event.allDay,
    pinned: event.pinned,
  };
}

function tintFromColor(color: string) {
  return `${color}18`;
}

function hourFromTime(time: string) {
  if (time === "All day") return 8;
  const [hour] = time.split(":").map(Number);
  return Number.isFinite(hour) ? hour : 8;
}

export default function CalendarDashboard() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const firedAlerts = useRef<Set<string>>(new Set());
  const alertItemsRef = useRef<RescheduleReminder[]>([]);
  const workspaceMutationVersion = useRef(0);
  const workspaceLoadVersion = useRef(0);
  const visitedSettingsRef = useRef(false);
  const notifiedInvitationIdsRef = useRef<Set<string>>(new Set());
  const previousTabRef = useRef<AppTab>("calendar");
  const [session, setSession] = useState<AppSession | null>(() =>
    readSession(),
  );
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const isAuthed = Boolean(session);
  const initialData = useMemo(() => readCalendarData(today), [today]);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState<CalendarView>("month");
  const [taskView, setTaskView] = useState<TaskView>("day");
  const [statsRange, setStatsRange] = useState<StatsRange>("monthly");
  const [activeTab, setActiveTab] = useState<AppTab>("calendar");
  const [activeSettingsSection, setActiveSettingsSection] =
    useState<SettingsSectionId>("profile");
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<CategoryStyle[]>([]);
  const [calendars, setCalendars] = useState<AppCalendar[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [savedSettings, setSavedSettings] = useState<AppSettings>(() => ({
    ...defaultSettings,
    theme: "light",
    skipIntro: false,
  }));
  const [settings, setSettings] = useState<AppSettings>(() => ({
    ...defaultSettings,
    theme: "light",
    skipIntro: false,
  }));
  const [eventReminders, setEventReminders] = useState<RescheduleReminder[]>(
    [],
  );
  const [calendarInvitations, setCalendarInvitations] = useState<CalendarInvitation[]>([]);
  const [alertsSeen, setAlertsSeen] = useState(true);
  const [standaloneTasks, setStandaloneTasks] = useState<StandaloneTask[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [calendarDraft, setCalendarDraft] = useState({
    name: "",
    color: "#007aff",
  });
  const [memberDraft, setMemberDraft] = useState({
    calendarId: "",
    email: "",
    role: "viewer" as "editor" | "viewer",
  });
  const [shareDrafts, setShareDrafts] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EventDraft>(() => emptyDraft(today, ""));
  const [eventReminderDraft, setEventReminderDraft] = useState<ReminderDraft>({
    enabled: false,
    preset: "10m",
    date: toDateKey(today),
    time: currentTimeValue(today),
  });
  const [composerKind, setComposerKind] = useState<ComposerKind>("event");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>({
    title: "",
    reminderEnabled: false,
    reminderDate: toDateKey(today),
    reminderTime: currentTimeValue(today),
    eventId: "none",
  });
  const [eventTaskDrafts, setEventTaskDrafts] = useState<
    Record<string, string>
  >({});
  const [composerOpen, setComposerOpen] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState<TagDraft>({
    label: "",
    icon: "tag",
    color: "#007aff",
  });
  const [cancelTarget, setCancelTarget] = useState<CalendarEvent | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancelScope, setCancelScope] = useState<CancelScope>("series-cancel");
  const [rescheduleTarget, setRescheduleTarget] =
    useState<CalendarEvent | null>(null);
  const [rescheduleDraft, setRescheduleDraft] = useState({
    date: toDateKey(addDays(today, 1)),
    time: "09:00",
  });
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceMessage, setWorkspaceMessage] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [composerSubmitting, setComposerSubmitting] = useState(false);
  const [busyActions, setBusyActions] = useState<Set<string>>(() => new Set());
  const [notificationPermissionState, setNotificationPermissionState] =
    useState("unsupported");
  const [pushStatus, setPushStatus] = useState("Checking push support...");
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushConfigured, setPushConfigured] = useState(false);
  const [cronConfigured, setCronConfigured] = useState(false);
  const [notificationActionMessage, setNotificationActionMessage] =
    useState("");
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [canVibrate, setCanVibrate] = useState(false);
  const toastRemovalTimers = useRef<Record<string, number>>({});
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notificationCapabilities, setNotificationCapabilities] =
    useState<NotificationCapabilities>(() => ({
      supportsNotifications: false,
      supportsServiceWorker: false,
      supportsPush: false,
      supportsVibration: false,
      isIOS: false,
      isPWAInstalled: false,
    }));
  const [deleteCalendarTarget, setDeleteCalendarTarget] =
    useState<AppCalendar | null>(null);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteAccountText, setDeleteAccountText] = useState("");
  const [introOpen, setIntroOpen] = useState(false);
  const [introSaving, setIntroSaving] = useState(false);
  const selectedKey = toDateKey(selectedDate);
  const monthDays = useMemo(() => getMonthDays(visibleMonth), [visibleMonth]);
  const tagMap = useMemo(
    () => Object.fromEntries(tags.map((tag) => [tag.id, tag])),
    [tags],
  );
  const visibleCalendarIds = useMemo(
    () =>
      new Set(
        calendars
          .filter((calendar) => calendar.visible)
          .map((calendar) => calendar.id),
      ),
    [calendars],
  );
  const hasVisibleCalendars = visibleCalendarIds.size > 0;

  const normalizedWorkspaceQuery = query.trim().toLowerCase();

  const linkedTaskEventIdsMatchingQuery = useMemo(() => {
    const eventIds = new Set<string>();

    if (!normalizedWorkspaceQuery) return eventIds;

    events.forEach((event) => {
      event.tasks.forEach((task) => {
        if (
          [task.title, event.title]
            .join(" ")
            .toLowerCase()
            .includes(normalizedWorkspaceQuery)
        ) {
          eventIds.add(event.id);
        }
      });
    });

    standaloneTasks.forEach((task) => {
      if (
        task.eventId &&
        [task.title, task.eventTitle]
          .join(" ")
          .toLowerCase()
          .includes(normalizedWorkspaceQuery)
      ) {
        eventIds.add(task.eventId);
      }
    });

    return eventIds;
  }, [events, normalizedWorkspaceQuery, standaloneTasks]);

  const selectedLinkedTaskEventIds = useMemo(() => {
    const eventIds = new Set<string>();

    if (!normalizedWorkspaceQuery) return eventIds;

    events.forEach((event) => {
      if (event.date !== selectedKey) return;

      event.tasks.forEach((task) => {
        if (
          [task.title, event.title, event.status]
            .join(" ")
            .toLowerCase()
            .includes(normalizedWorkspaceQuery)
        ) {
          eventIds.add(event.id);
        }
      });
    });

    standaloneTasks.forEach((task) => {
      const taskDate = task.date ?? task.reminderDate ?? selectedKey;

      if (taskDate !== selectedKey || !task.eventId) return;

      if (
        [task.title, task.eventTitle]
          .join(" ")
          .toLowerCase()
          .includes(normalizedWorkspaceQuery)
      ) {
        eventIds.add(task.eventId);
      }
    });

    return eventIds;
  }, [events, normalizedWorkspaceQuery, selectedKey, standaloneTasks]);

  const filteredEvents = useMemo(() => {
    return events
      .filter((event) => {
        const tag = tagMap[event.category];
        const eventTaskText = event.tasks.map((task) => task.title).join(" ");
        const matchesCategory =
          activeCategory === "all" || event.category === activeCategory;
        const matchesCalendar =
          !event.calendarId ||
          !hasVisibleCalendars ||
          visibleCalendarIds.has(event.calendarId) ||
          !calendars.some((calendar) => calendar.id === event.calendarId);
        const matchesQuery =
          !normalizedWorkspaceQuery ||
          [event.title, event.location, event.notes, tag?.label, eventTaskText]
            .join(" ")
            .toLowerCase()
            .includes(normalizedWorkspaceQuery) ||
          linkedTaskEventIdsMatchingQuery.has(event.id);

        return (
          matchesCalendar &&
          matchesCategory &&
          matchesQuery &&
          event.status !== "archived"
        );
      })
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) || a.time.localeCompare(b.time),
      );
  }, [
    activeCategory,
    calendars,
    events,
    hasVisibleCalendars,
    linkedTaskEventIdsMatchingQuery,
    normalizedWorkspaceQuery,
    tagMap,
    visibleCalendarIds,
  ]);

  const selectedEvents = useMemo(
    () =>
      filteredEvents.filter(
        (event) =>
          event.date === selectedKey || selectedLinkedTaskEventIds.has(event.id),
      ),
    [filteredEvents, selectedKey, selectedLinkedTaskEventIds],
  );
  
  const selectedReminders = useMemo(
    () =>
      events
        .flatMap((event) => event.rescheduleReminders)
        .filter((reminder) => reminder.date === selectedKey && !reminder.done)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [events, selectedKey],
  );
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const taskItems = useMemo((): TaskListItem[] => {
    const byId = new Map<string, TaskListItem>();

    events.forEach((event) => {
      event.tasks.forEach((task) => {
        byId.set(task.id, {
          ...task,
          eventId: event.id,
          eventTitle: event.title,
          eventStatus: event.status,
          date: event.date,
          time: event.time === "All day" ? undefined : event.time,
        });
      });
    });

    standaloneTasks.forEach((task) => {
      byId.set(task.id, {
        ...task,
        date: task.date ?? task.reminderDate ?? selectedKey,
        time: task.time ?? task.reminderTime,
      });
    });

    return Array.from(byId.values());
  }, [events, standaloneTasks, selectedKey]);
  const selectedTaskItems = useMemo(
    () => taskItems.filter((task) => task.date === selectedKey),
    [selectedKey, taskItems],
  );
  const taskViewKeys = useMemo(() => {
    if (taskView === "day") return new Set([selectedKey]);
    if (taskView === "week")
      return new Set(weekDays.map((day) => toDateKey(day)));
    return new Set(
      monthDays.filter((day) => day.currentMonth).map((day) => day.key),
    );
  }, [monthDays, selectedKey, taskView, weekDays]);
  const visibleTaskItems = useMemo(
    () => taskItems.filter((task) => taskViewKeys.has(task.date)),
    [taskItems, taskViewKeys],
  );
  const taskViewTitle = useMemo(() => {
    if (taskView === "day") {
      return selectedDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    }
    if (taskView === "week") {
      return `${weekDays[0].toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })} - ${weekDays[6].toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}`;
    }
    return formatMonthYear(visibleMonth);
  }, [selectedDate, taskView, visibleMonth, weekDays]);
  const alertItems = useMemo(() => {
    const reminderMinutes = parseReminderMinutes(
      settings.notifications.defaultTiming,
    );
    const eventAlerts = settings.notifications.eventReminders
      ? events
          .filter((event) => event.status === "scheduled")
          .map((event) => {
            const start = new Date(
              `${event.date}T${event.allDay || event.time === "All day" ? "09:00" : event.time}:00`,
            );
            const alertAt = new Date(start.getTime() - reminderMinutes * 60000);
            return {
              id: `event-alert-${event.id}-${reminderMinutes}`,
              eventId: event.id,
              title: `Event reminder: ${event.title}`,
              date: toDateKey(alertAt),
              time: currentTimeValue(alertAt),
              done: false,
              notificationSentAt: null,
            };
          })
      : [];
    const rescheduleAlerts = settings.notifications.rescheduleReminders
      ? events
          .flatMap((event) => event.rescheduleReminders)
          .concat(eventReminders)
      : [];
    const taskAlerts = settings.notifications.taskReminders
      ? standaloneTasks
          .filter(
            (task) => !task.done && task.reminderDate && task.reminderTime,
          )
          .map((task) => ({
            id: `task-alert-${task.id}`,
            eventId: task.eventId ?? "none",
            title: `Task reminder: ${task.title}`,
            date: task.reminderDate!,
            time: task.reminderTime!,
            done: task.done,
            notificationSentAt: task.notificationSentAt,
          }))
      : [];
    const dailyAgendaAlert = settings.notifications.dailyAgenda
      ? [
          {
            id: `daily-agenda-${toDateKey(today)}`,
            eventId: "none",
            title: `Daily agenda: ${selectedEvents.length} event${selectedEvents.length === 1 ? "" : "s"} today`,
            date: toDateKey(today),
            time: settings.notifications.quietEnd || "08:00",
            done: false,
            notificationSentAt: null,
          },
        ]
      : [];

    return [
      ...eventAlerts,
      ...rescheduleAlerts,
      ...taskAlerts,
      ...dailyAgendaAlert,
    ].sort((a, b) =>
      `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
    );
  }, [
    eventReminders,
    events,
    selectedEvents.length,
    settings.notifications,
    standaloneTasks,
    today,
  ]);
  const selectedAlertItems = useMemo(
    () => alertItems.filter((alert) => alert.date === selectedKey),
    [alertItems, selectedKey],
  );

  const searchedTaskItems = useMemo(() => {
    if (!normalizedWorkspaceQuery) return selectedTaskItems;

    return selectedTaskItems.filter((task) =>
      [task.title, task.eventTitle, task.eventStatus ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedWorkspaceQuery),
    );
  }, [normalizedWorkspaceQuery, selectedTaskItems]);

  const searchedVisibleTaskItems = useMemo(() => {
    if (!normalizedWorkspaceQuery) return visibleTaskItems;

    return visibleTaskItems.filter((task) =>
      [task.title, task.eventTitle, task.eventStatus ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedWorkspaceQuery),
    );
  }, [normalizedWorkspaceQuery, visibleTaskItems]);

  const searchedAlertItems = useMemo(() => {
    if (!normalizedWorkspaceQuery) return selectedAlertItems;

    return selectedAlertItems.filter((alert) =>
      [alert.title, alert.eventId]
        .join(" ")
        .toLowerCase()
        .includes(normalizedWorkspaceQuery),
    );
  }, [normalizedWorkspaceQuery, selectedAlertItems]);

  const searchedAllAlertItems = useMemo(() => {
    if (!normalizedWorkspaceQuery) return alertItems;

    return alertItems.filter((alert) =>
      [alert.title, alert.eventId]
        .join(" ")
        .toLowerCase()
        .includes(normalizedWorkspaceQuery),
    );
  }, [alertItems, normalizedWorkspaceQuery]);

  const hasNewAlerts =
    calendarInvitations.length > 0 && activeTab !== "alerts" && !alertsSeen;

  const unboundUndoneTasks = useMemo(
    () => standaloneTasks.filter((task) => !task.done && !task.eventId),
    [standaloneTasks],
  );

  const isPremium = session?.user.premium === true;

  const statsContext = useMemo(() => {
    const selectedYear = selectedKey.slice(0, 4);
    const selectedMonth = selectedKey.slice(0, 7);

    const activeRange: StatsRange = isPremium ? statsRange : "monthly";

    if (activeRange === "daily") {
      return {
        range: activeRange,
        label: selectedDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
        events: filteredEvents.filter((event) => event.date === selectedKey),
        tasks: taskItems.filter((task) => task.date === selectedKey),
      };
    }

    if (activeRange === "yearly") {
      return {
        range: activeRange,
        label: selectedYear,
        events: filteredEvents.filter((event) =>
          event.date.startsWith(selectedYear),
        ),
        tasks: taskItems.filter((task) => task.date.startsWith(selectedYear)),
      };
    }

    const monthDate = fromDateKey(`${selectedMonth}-01`);

    return {
      range: "monthly" as const,
      label: monthDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
      events: filteredEvents.filter((event) =>
        event.date.startsWith(selectedMonth),
      ),
      tasks: taskItems.filter((task) => task.date.startsWith(selectedMonth)),
    };
  }, [
    filteredEvents,
    isPremium,
    selectedDate,
    selectedKey,
    statsRange,
    taskItems,
  ]);

  const stats = useMemo(
    () => computeStats(statsContext.events, statsContext.tasks, tags),
    [statsContext, tags],
  );
  const aiSuggestions = useMemo(
    () => buildAiSuggestions(stats, filteredEvents),
    [filteredEvents, stats],
  );
  const notificationPermission = notificationPermissionState;

  useEffect(() => {
    alertItemsRef.current = alertItems;
  }, [alertItems]);

  useEffect(() => {
    if (!isPremium && statsRange !== "monthly") {
      setStatsRange("monthly");
    }
  }, [isPremium, statsRange]);

  useEffect(() => {
    if (activeTab === "alerts") {
      setAlertsSeen(true);
    }
  }, [activeTab]);

  useEffect(() => {
    if (calendarInvitations.length === 0) return;

    const newInvitations = calendarInvitations.filter(
      (invitation) => !notifiedInvitationIdsRef.current.has(invitation.id),
    );

    if (newInvitations.length === 0) return;

    newInvitations.forEach((invitation) => {
      notifiedInvitationIdsRef.current.add(invitation.id);
    });

    if (activeTab !== "alerts") {
      setAlertsSeen(false);
    }

    const firstInvite = newInvitations[0];
    const message =
      newInvitations.length === 1
        ? `New shared calendar invite: ${firstInvite.calendar.name}`
        : `${newInvitations.length} new shared calendar invites`;

    pushToast(message, "info");

    void showArcgendaNotification(
      message,
      settings.notifications.vibration,
    );
  }, [activeTab, calendarInvitations, settings.notifications.vibration]);

  function markBusy(action: string, busy: boolean) {
    setBusyActions((current) => {
      const next = new Set(current);
      if (busy) {
        next.add(action);
      } else {
        next.delete(action);
      }
      return next;
    });
  }

  function isBusy(action: string) {
    return busyActions.has(action);
  }

  function removeToast(id: string) {
    setToasts((current) =>
      current.map((toast) =>
        toast.id === id ? { ...toast, visible: false } : toast,
      ),
    );

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      delete toastRemovalTimers.current[id];
    }, 220);
  }

  function pushToast(message: string, tone: ToastTone = "info") {
    if (!message.trim()) return;

    const id = createId();

    setToasts((current) => [
      ...current,
      {
        id,
        message,
        tone,
        visible: false,
      },
    ]);

    requestAnimationFrame(() => {
      setToasts((current) =>
        current.map((toast) =>
          toast.id === id ? { ...toast, visible: true } : toast,
        ),
      );
    });

    toastRemovalTimers.current[id] = window.setTimeout(() => {
      removeToast(id);
    }, 3400);
  }

  function toastToneFromMessage(message: string): ToastTone {
    const text = message.toLowerCase();

    if (
      text.includes("could not") ||
      text.includes("failed") ||
      text.includes("error") ||
      text.includes("required") ||
      text.includes("invalid") ||
      text.includes("must") ||
      text.includes("not found")
    ) {
      return "error";
    }

    if (
      text.includes("warning") ||
      text.includes("quiet hours") ||
      text.includes("premium")
    ) {
      return "warning";
    }

    if (
      text.includes("saved") ||
      text.includes("created") ||
      text.includes("updated") ||
      text.includes("enabled") ||
      text.includes("disabled") ||
      text.includes("subscribed") ||
      text.includes("deleted") ||
      text.includes("sent")
    ) {
      return "success";
    }

    return "info";
  }

  function markWorkspaceMutation() {
    workspaceMutationVersion.current += 1;
  }

  function logDiagnostic(
    label: string,
    eventCount = events.length,
    theme = settings.theme,
  ) {
    console.log(`[Arcgenda diagnostics] ${label}`, {
      userId: session?.user.id ?? readSession()?.user.id ?? null,
      eventCount,
      workspaceMutationVersion: workspaceMutationVersion.current,
      workspaceLoadVersion: workspaceLoadVersion.current,
      theme,
    });
  }

  async function loadWorkspace(
    options: { message?: string; showLoading?: boolean } = {},
  ) {
    logDiagnostic("loadWorkspace() call");
    const storedSession = readSession();
    const sessionUserId = storedSession?.user.id;
    if (!sessionUserId) {
      clearSession();
      setSession(null);
      setSettingsLoaded(false);
      setWorkspaceReady(true);
      setWorkspaceLoading(false);
      setWorkspaceMessage("Sign in again to load your workspace.");
      return;
    }

    const loadVersionAtStart = ++workspaceLoadVersion.current;
    const mutationVersionAtStart = workspaceMutationVersion.current;
    const showLoading = options.showLoading ?? true;
    if (showLoading) setWorkspaceLoading(true);
    setWorkspaceMessage("");
    try {
      setWorkspaceReady(false);
      const [
        userPayload,
        calendarPayload,
        categoryPayload,
        eventPayload,
        taskPayload,
        reminderPayload,
        invitationPayload,
        preferencePayload,
      ] = await Promise.all([
        apiJson<{
          user: AppSession["user"] & {
            theme?: AppSettings["theme"];
            skipIntro?: boolean | null;
            plan?: "free" | "premium";
            premium?: boolean;
            premiumUntil?: string | null;
          };
        }>("/api/users/me"),
        apiJson<{ calendars: DbCalendar[]; limit: number }>("/api/calendars"),
        apiJson<{ categories: DbCategory[] }>("/api/categories"),
        apiJson<{ events: DbEvent[] }>("/api/events"),
        apiJson<{ tasks: DbTask[] }>("/api/tasks"),
        apiJson<{ reminders: DbReminder[] }>("/api/reminders"),
        apiJson<{ invitations: CalendarInvitation[] }>("/api/calendar-invitations"),
        apiJson<{ preferences: DbNotificationPreferences }>(
          "/api/settings/notifications",
        ),
      ]);
      const accessToken =
        (await createClient().auth.getSession()).data.session?.access_token ??
        readSession()?.accessToken;
      const nextSession = { accessToken, user: userPayload.user };

      let loadedCategories = categoryPayload.categories;
      if (loadedCategories.length === 0) {
        loadedCategories = await Promise.all(
          Object.values(categoryStyles).map(async (category) => {
            const payload = await apiJson<{ category: DbCategory }>(
              "/api/categories",
              {
                method: "POST",
                body: JSON.stringify({
                  name: category.label,
                  color: category.color,
                  icon: category.icon,
                }),
              },
            );
            return payload.category;
          }),
        );
      }

      let loadedCalendars = calendarPayload.calendars;
      if (loadedCalendars.length === 0) {
        const payload = await apiJson<{ calendar: DbCalendar }>(
          "/api/calendars",
          {
            method: "POST",
            body: JSON.stringify({ name: "My Calendar", color: "#007aff" }),
          },
        );
        loadedCalendars = [payload.calendar];
      }

      const eventCalendarIds = new Set(
        eventPayload.events
          .map((event) => event.calendarId)
          .filter((calendarId): calendarId is string => Boolean(calendarId)),
      );
      let mappedCalendars = loadedCalendars.map((calendar) => {
        const mapped = mapCalendar(calendar, nextSession);
        return eventCalendarIds.has(mapped.id)
          ? { ...mapped, visible: true }
          : mapped;
      });
      if (
        mappedCalendars.length > 0 &&
        !mappedCalendars.some((calendar) => calendar.visible)
      ) {
        mappedCalendars = mappedCalendars.map((calendar) => ({
          ...calendar,
          visible: true,
        }));
      }
      const calendarDisplayNames = Object.fromEntries(
        loadedCalendars
          .map((calendar) => {
            const ownMember = calendar.members.find(
              (member) => member.userId === nextSession.user.id,
            );
            return [calendar.id, ownMember?.displayName ?? ""];
          })
          .filter(([, value]) => value),
      ) as Record<string, string>;
      const loadedTheme = normalizeTheme(userPayload.user.theme);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THEME_STORAGE_KEY, loadedTheme);
      }
      const preferences = preferencePayload.preferences;
      const mappedSettings = mapPreferencesToSettings(
        preferences,
        defaultSettings,
        {
          accountName: userPayload.user.name ?? "",
          calendarDisplayNames,
        },
        loadedTheme,
        userPayload.user.skipIntro === true,
      );

      if (
        loadVersionAtStart !== workspaceLoadVersion.current ||
        mutationVersionAtStart !== workspaceMutationVersion.current
      ) {
        return;
      }

      saveSession(nextSession);
      setSession(nextSession);
      setCalendars(mappedCalendars);
      setTags(loadedCategories.map(mapCategory));
      const mappedEvents = eventPayload.events.map(mapEvent);

      setEvents(mappedEvents);

      if (!workspaceReady) {
        setSelectedDate(today);
        setVisibleMonth(startOfMonth(today));
        setActiveCategory("all");
      }
      setDraft((current) => ({
        ...current,
        category: current.category || loadedCategories[0]?.id || "",
        calendarId: current.calendarId || mappedCalendars[0]?.id || "",
      }));
      setMemberDraft((current) => ({
        ...current,
        calendarId: current.calendarId || mappedCalendars[0]?.id || "",
      }));
      setEventReminders(
        reminderPayload.reminders
          .filter((reminder) => !reminder.eventId && !reminder.taskId)
          .map(mapReminder),
      );
      setCalendarInvitations(invitationPayload.invitations);
      setStandaloneTasks(
        taskPayload.tasks.map((task) => mapStandaloneTask(task, today)),
      );
      setSavedSettings(mappedSettings);
      setSettings(mappedSettings);
      setSettingsLoaded(true);
      applyDocumentTheme(mappedSettings.theme, true);
      setWorkspaceReady(true);
      setIntroOpen(!mappedSettings.skipIntro);
      if (options.message) {
        setWorkspaceMessage(options.message);
      }
    } catch (error) {
      if (
        loadVersionAtStart !== workspaceLoadVersion.current ||
        mutationVersionAtStart !== workspaceMutationVersion.current
      ) {
        return;
      }
      clearSession();
      setSession(null);
      setSettingsLoaded(false);
      setWorkspaceReady(true);
      setWorkspaceMessage(
        error instanceof Error ? error.message : "Could not load workspace.",
      );
    } finally {
      if (showLoading) setWorkspaceLoading(false);
    }
  }

  async function refreshSchedule(message?: string) {
    if (!session) return;

    try {
      const [eventPayload, taskPayload, reminderPayload] = await Promise.all([
        apiJson<{ events: DbEvent[] }>("/api/events"),
        apiJson<{ tasks: DbTask[] }>("/api/tasks"),
        apiJson<{ reminders: DbReminder[] }>("/api/reminders"),
      ]);

      const mappedEvents = eventPayload.events.map(mapEvent);
      setEvents(mappedEvents);

      setStandaloneTasks(
        taskPayload.tasks.map((task) => mapStandaloneTask(task, today)),
      );

      setEventReminders(
        reminderPayload.reminders
          .filter((reminder) => !reminder.eventId && !reminder.taskId)
          .map(mapReminder),
      );

      if (message) setWorkspaceMessage(message);
    } catch (error) {
      setWorkspaceMessage(
        error instanceof Error ? error.message : "Could not refresh schedule.",
      );
    }
  }

  async function refreshPushStatus() {
    if (!isAuthed) return;
    const capabilities = detectNotificationCapabilities();
    setNotificationCapabilities(capabilities);
    setIsMobileDevice(detectMobileDevice());
    setCanVibrate(capabilities.supportsVibration);
    setNotificationPermissionState(
      capabilities.supportsNotifications
        ? Notification.permission
        : "unsupported",
    );

    if (!capabilities.supportsPush) {
      setPushConfigured(false);
      setPushSubscribed(false);
      setCronConfigured(false);
      setPushStatus(
        capabilities.isIOS && !capabilities.isPWAInstalled
          ? "Install Arcgenda to Home Screen to enable iPhone push notifications."
          : "Web Push is not supported in this browser.",
      );
      return;
    }

    try {
      const payload = await apiJson<{
        publicKey: string;
        configured: boolean;
        cronConfigured: boolean;
        subscriptions: Array<{ endpoint: string }>;
      }>("/api/notifications/subscribe");
      setPushConfigured(payload.configured);
      setCronConfigured(payload.cronConfigured);
      if (!payload.configured || !payload.publicKey) {
        setPushSubscribed(false);
        setPushStatus(
          "Closed-app push notifications are not configured yet. Add VAPID keys.",
        );
        return;
      }
      const registration = await registerServiceWorker();
      const browserSubscription =
        await registration?.pushManager.getSubscription();
      const subscribed = Boolean(
        browserSubscription &&
        payload.subscriptions.some(
          (subscription) =>
            subscription.endpoint === browserSubscription.endpoint,
        ),
      );
      setPushSubscribed(subscribed);
      setPushStatus(
        subscribed
          ? payload.cronConfigured
            ? "This device is subscribed for Web Push."
            : "This device is subscribed, but background reminder delivery is not fully configured yet."
          : "This device is not subscribed for Web Push yet.",
      );
    } catch (error) {
      setWorkspaceReady(true);
      setPushStatus(
        error instanceof Error ? error.message : "Could not check push status.",
      );
    }
  }

  async function subscribeToPushNotifications() {
    setNotificationActionMessage("");
    try {
      if (!("Notification" in window))
        throw new Error("This browser does not support notifications.");
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error(
          "This browser does not support Web Push subscriptions.",
        );
      }
      const permission = await requestNotificationPermission();
      setNotificationPermissionState(permission);
      if (permission !== "granted")
        throw new Error("Notification permission was not granted.");

      const status = await apiJson<{ publicKey: string; configured: boolean }>(
        "/api/notifications/subscribe",
      );
      if (!status.configured || !status.publicKey) {
        throw new Error(
          "Web Push is not configured. Add VAPID keys to the environment first.",
        );
      }

      const registration = await registerServiceWorker();
      if (!registration) throw new Error("Service worker registration failed.");
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(status.publicKey),
        }));

      await apiJson("/api/notifications/subscribe", {
        method: "POST",
        body: JSON.stringify(subscription.toJSON()),
      });
      setPushSubscribed(true);
      setPushConfigured(true);
      setPushStatus(
        cronConfigured
          ? "This device is subscribed for Web Push."
          : "This device is subscribed, but background reminder delivery is not fully configured yet.",
      );
      setNotificationActionMessage(
        "Notifications are enabled for this device.",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not enable notifications.";
      setPushStatus(message);
      setNotificationActionMessage(message);
    }
  }

  async function unsubscribeFromPushNotifications() {
    setNotificationActionMessage("");
    try {
      const registration =
        "serviceWorker" in navigator
          ? await navigator.serviceWorker.ready
          : null;
      const subscription = await registration?.pushManager.getSubscription();
      await apiJson("/api/notifications/unsubscribe", {
        method: "DELETE",
        body: JSON.stringify({ endpoint: subscription?.endpoint }),
      });
      await subscription?.unsubscribe();
      setPushSubscribed(false);
      setPushStatus("This device is unsubscribed from Web Push.");
      setNotificationActionMessage("Notifications disabled for this device.");
    } catch (error) {
      setNotificationActionMessage(
        error instanceof Error
          ? error.message
          : "Could not disable notifications.",
      );
    }
  }

  async function sendTestNotification() {
    setNotificationActionMessage("");
    try {
      if (!pushSubscribed) await subscribeToPushNotifications();
      const payload = await apiJson<{
        message: string;
        sent: number;
        skippedForQuietHours?: boolean;
      }>("/api/notifications/test", { method: "POST" });
      setNotificationActionMessage(payload.message);
      if (payload.sent > 0) await refreshPushStatus();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not send test notification.";
      setNotificationActionMessage(message);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Arcgenda test notification", {
          body: "This is only a foreground test notification.",
          icon: "/icons/arcgenda-icon-192.png",
        });
        setNotificationActionMessage(
          `${message} Foreground test notification was shown.`,
        );
      }
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadWorkspace(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshPushStatus(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  useEffect(() => {
    const applyTheme = () => {
      applyDocumentTheme(settings.theme, true);
    };

    applyTheme();

    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener("change", applyTheme);

    return () => media?.removeEventListener("change", applyTheme);
  }, [settings.theme]);

  useEffect(() => {
    if (!workspaceMessage) return;
    pushToast(workspaceMessage, toastToneFromMessage(workspaceMessage));
    setWorkspaceMessage("");
  }, [workspaceMessage]);

  useEffect(() => {
    if (!settingsMessage) return;
    pushToast(settingsMessage, toastToneFromMessage(settingsMessage));
    setSettingsMessage("");
  }, [settingsMessage]);

  useEffect(() => {
    if (!settingsError) return;
    pushToast(settingsError, "error");
    setSettingsError("");
  }, [settingsError]);

  useEffect(() => {
    if (!notificationActionMessage) return;
    pushToast(
      notificationActionMessage,
      toastToneFromMessage(notificationActionMessage),
    );
    setNotificationActionMessage("");
  }, [notificationActionMessage]);

  useEffect(() => {
    return () => {
      Object.values(toastRemovalTimers.current).forEach((timer) =>
        window.clearTimeout(timer),
      );
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNotificationPermissionState(
        "Notification" in window ? Notification.permission : "unsupported",
      );
      setIsMobileDevice(detectMobileDevice());
      setCanVibrate(canVibrateDevice());
      setNotificationCapabilities(detectNotificationCapabilities());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function revertUnsavedSettings() {
    setSettings(savedSettings);
    applyDocumentTheme(savedSettings.theme, true);
    setSettingsMessage("");
    setSettingsError("");
  }

  useEffect(() => {
    const previousTab = previousTabRef.current;

    if (activeTab === "settings") {
      visitedSettingsRef.current = true;
    }

    if (
      settingsLoaded &&
      visitedSettingsRef.current &&
      previousTab === "settings" &&
      activeTab !== "settings"
    ) {
      const timer = window.setTimeout(() => {
        revertUnsavedSettings();
      }, 0);

      previousTabRef.current = activeTab;
      return () => window.clearTimeout(timer);
    }

    previousTabRef.current = activeTab;
  }, [activeTab, settingsLoaded]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (
        settingsLoaded &&
        document.visibilityState === "hidden" &&
        activeTab === "settings"
      ) {
        revertUnsavedSettings();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [activeTab, settingsLoaded, savedSettings]);

  useEffect(() => {
    if (!isAuthed) return;

    const checkAlerts = () => {
      const now = new Date();
      alertItemsRef.current.forEach((item) => {
        if (
          firedAlerts.current.has(item.id) ||
          item.done ||
          item.notificationSentAt ||
          (!isReminderDueNow(item, now) && !isReminderTooOld(item, now))
        ) {
          return;
        }

        firedAlerts.current.add(item.id);
        if (
          isReminderTooOld(item, now) ||
          isQuietTime(settings.notifications, now)
        ) {
          return;
        }

        if (
          deviceNotificationsEnabled(settings.notifications) &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          void showArcgendaNotification(
            item.title,
            settings.notifications.vibration,
          );
          if (
            !item.id.startsWith("event-alert-") &&
            !item.id.startsWith("task-alert-") &&
            !item.id.startsWith("daily-agenda-")
          ) {
            void apiJson(`/api/reminders/${item.id}`, {
              method: "PATCH",
              body: JSON.stringify({ notificationSent: true }),
            });
            setEventReminders((current) =>
              current.map((reminder) =>
                reminder.id === item.id
                  ? {
                      ...reminder,
                      notificationSentAt: new Date().toISOString(),
                    }
                  : reminder,
              ),
            );
          }
          return;
        }

        if (
          deviceNotificationsEnabled(settings.notifications) &&
          "Notification" in window &&
          Notification.permission === "default"
        ) {
          void requestNotificationPermission().then((permission) => {
            setNotificationPermissionState(permission);
            if (permission === "granted") {
              void showArcgendaNotification(
                item.title,
                settings.notifications.vibration,
              );
              if (
                !item.id.startsWith("event-alert-") &&
                !item.id.startsWith("task-alert-") &&
                !item.id.startsWith("daily-agenda-")
              ) {
                void apiJson(`/api/reminders/${item.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ notificationSent: true }),
                });
                setEventReminders((current) =>
                  current.map((reminder) =>
                    reminder.id === item.id
                      ? {
                          ...reminder,
                          notificationSentAt: new Date().toISOString(),
                        }
                      : reminder,
                  ),
                );
              }
            }
          });
        }
      });
    };

    checkAlerts();
    const interval = window.setInterval(checkAlerts, 30000);
    return () => window.clearInterval(interval);
  }, [isAuthed, settings.notifications]);

  function tagFor(event: CalendarEvent) {
    return tagMap[event.category] ?? tags[0];
  }

  function movePeriod(direction: -1 | 1) {
    if (view === "month") {
      setVisibleMonth(
        new Date(
          visibleMonth.getFullYear(),
          visibleMonth.getMonth() + direction,
          1,
        ),
      );
      return;
    }

    const nextDate = addDays(
      selectedDate,
      view === "week" ? direction * 7 : direction,
    );
    setSelectedDate(nextDate);
    setVisibleMonth(startOfMonth(nextDate));
  }

  function selectDate(date: Date) {
    setSelectedDate(date);
    setVisibleMonth(startOfMonth(date));
    setActiveTab("calendar");
  }

  function openNewEvent() {
    if (composerSubmitting) return;
    setEditingId(null);
    const now = new Date();
    setComposerKind("event");
    setDraft({
      ...emptyDraft(selectedDate, tags[0]?.id ?? ""),
      calendarId:
        calendars.find((calendar) => calendar.visible)?.id ??
        calendars[0]?.id ??
        "",
      time: currentTimeValue(now),
    });
    setEventReminderDraft({
      enabled: false,
      preset: "10m",
      date: toDateKey(selectedDate),
      time: currentTimeValue(now),
    });
    setSelectedTaskIds([]);
    setTaskDraft({
      title: "",
      reminderEnabled: false,
      reminderDate: toDateKey(selectedDate),
      reminderTime: currentTimeValue(now),
      eventId: "none",
    });
    setComposerOpen(true);
  }

  function openNewItem() {
    openNewEvent();
    if (activeTab === "tasks") {
      setComposerKind("task");
    }
  }

  function openEditEvent(event: CalendarEvent) {
    if (
      event.status === "archived" ||
      composerSubmitting ||
      isBusy(`event:${event.id}`)
    )
      return;

    const existingTag = tags.find((tag) => tag.id === event.category);
    const safeCategory = existingTag?.id ?? tags[0]?.id ?? "";

    setEditingId(event.id);
    setComposerKind("event");
    setDraft({
      ...eventToDraft(event),
      category: safeCategory,
    });
    setSelectedTaskIds([]);
    setComposerOpen(true);
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (composerSubmitting) return;

    const title = taskDraft.title.trim();

    if (!title) {
      setWorkspaceMessage("Task title is required.");
      return;
    }

    const eventId =
      taskDraft.eventId && taskDraft.eventId !== "none"
        ? taskDraft.eventId
        : undefined;

    const taskDate = taskDraft.reminderDate || toDateKey(selectedDate);
    const taskTime = taskDraft.reminderTime || currentTimeValue();

    const dueDate = `${taskDate}T${taskTime}:00`;

    if (taskDraft.reminderEnabled && !isFutureDateTime(taskDate, taskTime)) {
      setWorkspaceMessage("Choose a future reminder time for this task.");
      return;
    }

    const tempId = `temp-task-${createId()}`;

    const optimisticTask: StandaloneTask = {
      id: tempId,
      title,
      done: false,
      date: taskDate,
      time: taskTime,
      reminderDate: taskDraft.reminderEnabled ? taskDate : undefined,
      reminderTime: taskDraft.reminderEnabled ? taskTime : undefined,
      eventId: eventId ?? null,
      eventTitle: eventId
        ? (events.find((item) => item.id === eventId)?.title ?? "Linked event")
        : "Standalone task",
      notificationSentAt: null,
    };

    const previousTasks = standaloneTasks;
    const previousEvents = events;

    setComposerSubmitting(true);
    markWorkspaceMutation();

    if (eventId) {
      setEvents((current) =>
        current.map((calendarEvent) =>
          calendarEvent.id === eventId
            ? {
                ...calendarEvent,
                tasks: [
                  ...calendarEvent.tasks,
                  { id: tempId, title, done: false },
                ],
              }
            : calendarEvent,
        ),
      );
    } else {
      setStandaloneTasks((current) => [optimisticTask, ...current]);
    }

    try {
      const payload = await apiJson<{ task: DbTask }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title,
          eventId,
          dueDate,
        }),
      });

      if (taskDraft.reminderEnabled) {
        await apiJson("/api/reminders", {
          method: "POST",
          body: JSON.stringify({
            taskId: payload.task.id,
            title: `Task reminder: ${title}`,
            remindAt: dueDate,
          }),
        });
      }

      await refreshSchedule("Task created.");

      setTaskDraft({
        title: "",
        reminderEnabled: false,
        reminderDate: toDateKey(selectedDate),
        reminderTime: currentTimeValue(),
        eventId: "none",
      });

      setComposerOpen(false);
      setActiveTab("tasks");
    } catch (error) {
      setStandaloneTasks(previousTasks);
      setEvents(previousEvents);
      setWorkspaceMessage(
        error instanceof Error ? error.message : "Could not create task.",
      );
    } finally {
      setComposerSubmitting(false);
    }
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    logDiagnostic("saveEvent() call");
    if (composerSubmitting) return;
    const title = draft.title.trim();
    if (!title) return;

    const previous = events.find((item) => item.id === editingId);
    const nextCalendar = calendars.find(
      (calendar) => calendar.id === draft.calendarId,
    );
    const previousCalendar = calendars.find(
      (calendar) => calendar.id === previous?.calendarId,
    );
    if (
      previous &&
      nextCalendar &&
      previousCalendar &&
      previousCalendar.shared !== nextCalendar.shared &&
      !window.confirm(
        `Move "${previous.title}" from ${previousCalendar.name} to ${nextCalendar.name}? Linked tasks and reminders will stay attached.`,
      )
    ) {
      return;
    }

    const startDate = dateTimeFromDraft(draft.date, draft.time, draft.allDay);
    let reminderDateTime: { date: string; time: string } | null = null;
    try {
      reminderDateTime = resolveReminderDateTime(
        eventReminderDraft,
        startDate,
        draft.recurrence,
      );
    } catch (error) {
      setWorkspaceMessage(
        error instanceof Error ? error.message : "Choose a valid reminder.",
      );
      return;
    }
    if (
      reminderDateTime &&
      !isFutureDateTime(reminderDateTime.date, reminderDateTime.time)
    ) {
      setWorkspaceMessage("Choose a future reminder time for this event.");
      return;
    }
    const endDate = new Date(
      new Date(startDate).getTime() +
        minutesFromDuration(draft.duration) * 60000,
    ).toISOString();
    const payload = {
      calendarId: draft.calendarId || undefined,
      categoryId: draft.category,
      title,
      description: draft.notes.trim(),
      startDate,
      endDate,
      allDay: draft.allDay,
      location: draft.location.trim() || "No location",
      priority: previous?.priority ?? "normal",
      recurrence: draft.recurrence,
      pinned: draft.pinned,
    };
    const optimisticId = editingId ?? `temp-${createId()}`;
    const previousEvents = events;
    const optimisticEvent: CalendarEvent = {
      id: optimisticId,
      calendarId: draft.calendarId || undefined,
      title,
      date: draft.date,
      time: draft.allDay ? "All day" : draft.time,
      duration: draft.duration,
      category: draft.category,
      priority: previous?.priority ?? "normal",
      recurrence: draft.recurrence,
      location: draft.location.trim() || "No location",
      notes: draft.notes.trim(),
      allDay: draft.allDay,
      pinned: draft.pinned,
      status: previous?.status ?? "scheduled",
      tasks: previous?.tasks ?? [],
      rescheduleReminders: previous?.rescheduleReminders ?? [],
      sharedWith: previous?.sharedWith,
      activity: previous?.activity,
    };

    setComposerSubmitting(true);
    markWorkspaceMutation();
    if (editingId) {
      console.log(
        "[Arcgenda diagnostics] before setEvents(saveEvent optimistic edit)",
        {
          previousEventCount: events.length,
          nextEventCount: events.length,
          userId: session?.user.id ?? readSession()?.user.id ?? null,
          workspaceMutationVersion: workspaceMutationVersion.current,
          workspaceLoadVersion: workspaceLoadVersion.current,
          theme: settings.theme,
        },
      );
      setEvents((current) =>
        current.map((item) => (item.id === editingId ? optimisticEvent : item)),
      );
      console.log(
        "[Arcgenda diagnostics] after setEvents(saveEvent optimistic edit)",
        {
          previousEventCount: events.length,
          nextEventCount: events.length,
          userId: session?.user.id ?? readSession()?.user.id ?? null,
          workspaceMutationVersion: workspaceMutationVersion.current,
          workspaceLoadVersion: workspaceLoadVersion.current,
          theme: settings.theme,
        },
      );
    } else {
      console.log(
        "[Arcgenda diagnostics] before setEvents(saveEvent optimistic create)",
        {
          previousEventCount: events.length,
          nextEventCount: events.length + 1,
          userId: session?.user.id ?? readSession()?.user.id ?? null,
          workspaceMutationVersion: workspaceMutationVersion.current,
          workspaceLoadVersion: workspaceLoadVersion.current,
          theme: settings.theme,
        },
      );
      setEvents((current) => [optimisticEvent, ...current]);
      console.log(
        "[Arcgenda diagnostics] after setEvents(saveEvent optimistic create)",
        {
          previousEventCount: events.length,
          nextEventCount: events.length + 1,
          userId: session?.user.id ?? readSession()?.user.id ?? null,
          workspaceMutationVersion: workspaceMutationVersion.current,
          workspaceLoadVersion: workspaceLoadVersion.current,
          theme: settings.theme,
        },
      );
    }
    setSelectedDate(fromDateKey(draft.date));
    setVisibleMonth(startOfMonth(fromDateKey(draft.date)));
    setComposerOpen(false);
    setEditingId(null);
    setSelectedTaskIds([]);

    try {
      const saved = editingId
        ? await apiJson<{ event: DbEvent }>(`/api/events/${editingId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await apiJson<{ event: DbEvent }>("/api/events", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      const savedEvent = mapEvent(saved.event);
      if (activeCategory !== "all" && activeCategory !== savedEvent.category) {
        setActiveCategory("all");
      }

      await Promise.all(
        selectedTaskIds.map((taskId) =>
          apiJson(`/api/tasks/${taskId}`, {
            method: "PATCH",
            body: JSON.stringify({ eventId: saved.event.id }),
          }),
        ),
      );

      if (reminderDateTime) {
        await apiJson("/api/reminders", {
          method: "POST",
          body: JSON.stringify({
            eventId: saved.event.id,
            title: `Event reminder: ${title}`,
            remindAt: `${reminderDateTime.date}T${reminderDateTime.time}:00`,
          }),
        });
      }
      console.log("[Arcgenda diagnostics] before setEvents(saveEvent saved)", {
        previousEventCount: events.length,
        nextEventCount: editingId
          ? events.length
          : events.filter(
              (item) => item.id !== optimisticId && item.id !== savedEvent.id,
            ).length + 1,
        userId: session?.user.id ?? readSession()?.user.id ?? null,
        workspaceMutationVersion: workspaceMutationVersion.current,
        workspaceLoadVersion: workspaceLoadVersion.current,
        theme: settings.theme,
      });
      setEvents((current) =>
        editingId
          ? current.map((item) =>
              item.id === editingId || item.id === optimisticId
                ? savedEvent
                : item,
            )
          : [
              savedEvent,
              ...current.filter(
                (item) => item.id !== optimisticId && item.id !== savedEvent.id,
              ),
            ],
      );
      console.log("[Arcgenda diagnostics] after setEvents(saveEvent saved)", {
        previousEventCount: events.length,
        nextEventCount: editingId
          ? events.length
          : events.filter(
              (item) => item.id !== optimisticId && item.id !== savedEvent.id,
            ).length + 1,
        userId: session?.user.id ?? readSession()?.user.id ?? null,
        workspaceMutationVersion: workspaceMutationVersion.current,
        workspaceLoadVersion: workspaceLoadVersion.current,
        theme: settings.theme,
      });
      if (selectedTaskIds.length > 0 || reminderDateTime) {
        await refreshSchedule(editingId ? "Event saved." : "Event created.");
      } else {
        setWorkspaceMessage(editingId ? "Event saved." : "Event created.");
      }
      setSelectedDate(fromDateKey(savedEvent.date));
      setVisibleMonth(startOfMonth(fromDateKey(savedEvent.date)));
    } catch (error) {
      console.log(
        "[Arcgenda diagnostics] before setEvents(saveEvent rollback)",
        {
          previousEventCount: events.length,
          nextEventCount: previousEvents.length,
          userId: session?.user.id ?? readSession()?.user.id ?? null,
          workspaceMutationVersion: workspaceMutationVersion.current,
          workspaceLoadVersion: workspaceLoadVersion.current,
          theme: settings.theme,
        },
      );
      setEvents(previousEvents);
      console.log(
        "[Arcgenda diagnostics] after setEvents(saveEvent rollback)",
        {
          previousEventCount: events.length,
          nextEventCount: previousEvents.length,
          userId: session?.user.id ?? readSession()?.user.id ?? null,
          workspaceMutationVersion: workspaceMutationVersion.current,
          workspaceLoadVersion: workspaceLoadVersion.current,
          theme: settings.theme,
        },
      );
      setWorkspaceMessage(
        error instanceof Error ? error.message : "Could not save event.",
      );
      return;
    } finally {
      setComposerSubmitting(false);
    }
  }

  async function deleteEvent(id: string) {
    const action = `event:${id}:delete`;
    if (isBusy(action)) return;
    const previousEvents = events;
    setEvents((current) =>
      current.map((event) =>
        event.id === id ? { ...event, status: "archived" } : event,
      ),
    );
    markBusy(action, true);
    try {
      await apiJson(`/api/events/${id}`, { method: "DELETE" });
      setWorkspaceMessage("Event archived.");
    } catch (error) {
      setEvents(previousEvents);
      setWorkspaceMessage(
        error instanceof Error ? error.message : "Could not archive event.",
      );
    } finally {
      markBusy(action, false);
    }
  }

  async function confirmCancelEvent() {
    if (!cancelTarget) return;
    if (cancelTarget.recurrence !== "none" && cancelScope === "series-delete") {
      const id = cancelTarget.id;
      setCancelTarget(null);
      setCancellationReason("");
      setCancelScope("series-cancel");
      await deleteEvent(id);
      return;
    }

    const action = `event:${cancelTarget.id}:cancel`;
    if (isBusy(action)) return;
    const previousEvents = events;
    const optimisticCancelled: CalendarEvent = {
      ...cancelTarget,
      status: "cancelled",
      cancellationReason,
      cancelledAt: new Date().toISOString(),
    };
    setEvents((current) =>
      current.map((event) =>
        event.id === cancelTarget.id ? optimisticCancelled : event,
      ),
    );
    setCancelTarget(null);
    setCancellationReason("");
    setCancelScope("series-cancel");
    setRescheduleTarget(optimisticCancelled);
    setRescheduleDraft({
      date: toDateKey(addDays(fromDateKey(cancelTarget.date), 1)),
      time: "09:00",
    });
    markBusy(action, true);
    try {
      const payload = await apiJson<{ event: DbEvent }>(
        `/api/events/${cancelTarget.id}/cancel`,
        {
          method: "PATCH",
          body: JSON.stringify({
            cancellationReason,
            cancellationScope:
              cancelTarget.recurrence === "none" ? "single" : "series",
          }),
        },
      );
      const cancelledEvent = mapEvent(payload.event);
      setEvents((current) =>
        current.map((event) =>
          event.id === cancelledEvent.id ? cancelledEvent : event,
        ),
      );
      setRescheduleTarget(cancelledEvent);
    } catch (error) {
      setEvents(previousEvents);
      setRescheduleTarget(null);
      setWorkspaceMessage(
        error instanceof Error ? error.message : "Could not cancel event.",
      );
    } finally {
      markBusy(action, false);
    }
  }

  async function undoCancelEvent(id: string) {
    const action = `event:${id}:undo`;
    if (isBusy(action)) return;
    const previousEvents = events;
    setEvents((current) =>
      current.map((event) =>
        event.id === id
          ? {
              ...event,
              status: "scheduled",
              cancellationReason: undefined,
              cancelledAt: undefined,
            }
          : event,
      ),
    );
    markBusy(action, true);
    try {
      const payload = await apiJson<{ event: DbEvent }>(`/api/events/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "scheduled" }),
      });
      const restoredEvent = mapEvent(payload.event);
      setEvents((current) =>
        current.map((event) =>
          event.id === restoredEvent.id ? restoredEvent : event,
        ),
      );
      setWorkspaceMessage("Event restored.");
    } catch (error) {
      setEvents(previousEvents);
      setWorkspaceMessage(
        error instanceof Error ? error.message : "Could not restore event.",
      );
    } finally {
      markBusy(action, false);
    }
  }

  async function createRescheduleReminder() {
    if (!rescheduleTarget) return;
    if (!isFutureDateTime(rescheduleDraft.date, rescheduleDraft.time)) {
      setWorkspaceMessage("Choose a future time for the reschedule reminder.");
      return;
    }
    const action = `reschedule:${rescheduleTarget.id}`;
    if (isBusy(action)) return;
    markBusy(action, true);
    try {
      const title = `Reschedule: ${rescheduleTarget.title}`;
      await apiJson("/api/reminders", {
        method: "POST",
        body: JSON.stringify({
          eventId: rescheduleTarget.id,
          title,
          remindAt: `${rescheduleDraft.date}T${rescheduleDraft.time}:00`,
        }),
      });
      await apiJson("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          eventId: rescheduleTarget.id,
          title,
          dueDate: `${rescheduleDraft.date}T${rescheduleDraft.time}:00`,
        }),
      });
      const refreshed = await apiJson<{ events: DbEvent[] }>("/api/events");
      setEvents(refreshed.events.map(mapEvent));
      selectDate(fromDateKey(rescheduleDraft.date));
      setActiveTab("alerts");
      setRescheduleTarget(null);
    } catch (error) {
      setWorkspaceMessage(
        error instanceof Error ? error.message : "Could not create reminder.",
      );
    } finally {
      markBusy(action, false);
    }
  }

  async function toggleTask(taskId: string) {
    const action = `task:${taskId}:toggle`;
    if (isBusy(action)) return;
    const task =
      standaloneTasks.find((item) => item.id === taskId) ??
      events.flatMap((event) => event.tasks).find((item) => item.id === taskId);
    if (!task) return;
    const previousEvents = events;
    const previousTasks = standaloneTasks;
    setStandaloneTasks((current) =>
      current.map((item) =>
        item.id === taskId ? { ...item, done: !item.done } : item,
      ),
    );
    setEvents((current) =>
      current.map((event) => ({
        ...event,
        tasks: event.tasks.map((item) =>
          item.id === taskId ? { ...item, done: !item.done } : item,
        ),
      })),
    );
    markBusy(action, true);
    try {
      await apiJson(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: !task.done }),
      });
      setWorkspaceMessage("Task updated.");
    } catch (error) {
      setEvents(previousEvents);
      setStandaloneTasks(previousTasks);
      setWorkspaceMessage(
        error instanceof Error ? error.message : "Could not update task.",
      );
    } finally {
      markBusy(action, false);
    }
  }

    async function editTaskTitle(taskId: string, currentTitle: string) {
    const nextTitle = window.prompt("Edit task title", currentTitle)?.trim();

    if (!nextTitle || nextTitle === currentTitle) return;

    const action = `task:${taskId}:edit-title`;
    if (isBusy(action)) return;

    const previousEvents = events;
    const previousTasks = standaloneTasks;

    setStandaloneTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, title: nextTitle } : task,
      ),
    );

    setEvents((current) =>
      current.map((event) => ({
        ...event,
        tasks: event.tasks.map((task) =>
          task.id === taskId ? { ...task, title: nextTitle } : task,
        ),
      })),
    );

    markBusy(action, true);

    try {
      await apiJson(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: nextTitle }),
      });

      setWorkspaceMessage("Task renamed.");
    } catch (error) {
      setEvents(previousEvents);
      setStandaloneTasks(previousTasks);
      setWorkspaceMessage(
        error instanceof Error ? error.message : "Could not rename task.",
      );
    } finally {
      markBusy(action, false);
    }
  }

  async function createTaskForEvent(eventId: string) {
    const action = `event:${eventId}:create-task`;
    if (isBusy(action)) return;
    const title = eventTaskDrafts[eventId]?.trim();
    if (!title) return;

    const tempId = `temp-task-${createId()}`;
    const previousEvents = events;
    setEvents((current) =>
      current.map((event) =>
        event.id === eventId
          ? {
              ...event,
              tasks: [...event.tasks, { id: tempId, title, done: false }],
            }
          : event,
      ),
    );
    setEventTaskDrafts((current) => ({ ...current, [eventId]: "" }));
    markBusy(action, true);
    try {
      const payload = await apiJson<{ task: DbTask }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ eventId, title }),
      });
      setEvents((current) =>
        current.map((event) =>
          event.id === eventId
            ? {
                ...event,
                tasks: [
                  ...event.tasks.filter((task) => task.id !== tempId),
                  {
                    id: payload.task.id,
                    title: payload.task.title,
                    done: payload.task.completed,
                  },
                ],
              }
            : event,
        ),
      );
    } catch (error) {
      setEvents(previousEvents);
      setWorkspaceMessage(
        error instanceof Error
          ? error.message
          : "Could not create linked task.",
      );
    } finally {
      markBusy(action, false);
    }
  }

  async function linkTaskToEvent(eventId: string, taskId: string) {
    const action = `task:${taskId}:link`;
    if (isBusy(action)) return;
    const task = standaloneTasks.find((item) => item.id === taskId);
    if (!task) return;
    const previousEvents = events;
    const previousTasks = standaloneTasks;
    setStandaloneTasks((current) =>
      current.filter((item) => item.id !== taskId),
    );
    setEvents((current) =>
      current.map((event) =>
        event.id === eventId
          ? {
              ...event,
              tasks: [
                ...event.tasks,
                { id: task.id, title: task.title, done: task.done },
              ],
            }
          : event,
      ),
    );
    markBusy(action, true);
    try {
      await apiJson(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ eventId }),
      });
      setWorkspaceMessage("Task linked.");
    } catch (error) {
      setEvents(previousEvents);
      setStandaloneTasks(previousTasks);
      setWorkspaceMessage(
        error instanceof Error ? error.message : "Could not link task.",
      );
    } finally {
      markBusy(action, false);
    }
  }

  async function unlinkTaskFromEvent(_eventId: string, taskId: string) {
    const action = `task:${taskId}:unlink`;
    if (isBusy(action)) return;

    const linkedTask = events
      .flatMap((event) => event.tasks)
      .find((task) => task.id === taskId);

    const previousEvents = events;
    const previousTasks = standaloneTasks;
    const fallbackDate = toDateKey(selectedDate);
    const fallbackTime = currentTimeValue();

    setEvents((current) =>
      current.map((event) => ({
        ...event,
        tasks: event.tasks.filter((task) => task.id !== taskId),
      })),
    );

    if (linkedTask) {
      setStandaloneTasks((current) => [
        {
          id: linkedTask.id,
          title: linkedTask.title,
          done: linkedTask.done,
          date: fallbackDate,
          time: fallbackTime,
          reminderDate: undefined,
          reminderTime: undefined,
          eventId: null,
          eventTitle: "Standalone task",
          notificationSentAt: null,
        },
        ...current,
      ]);
    }

    markBusy(action, true);

    try {
      await apiJson(`/api/tasks/${taskId}/unlink-event`, { method: "PATCH" });
      await refreshSchedule("Task unlinked.");
    } catch (error) {
      setEvents(previousEvents);
      setStandaloneTasks(previousTasks);
      setWorkspaceMessage(
        error instanceof Error ? error.message : "Could not unlink task.",
      );
    } finally {
      markBusy(action, false);
    }
  }

  async function deleteTask(taskId: string) {
    const action = `task:${taskId}:delete`;
    if (isBusy(action)) return;
    const previousEvents = events;
    const previousTasks = standaloneTasks;
    setStandaloneTasks((current) =>
      current.filter((task) => task.id !== taskId),
    );
    setEvents((current) =>
      current.map((event) => ({
        ...event,
        tasks: event.tasks.filter((task) => task.id !== taskId),
      })),
    );
    markBusy(action, true);
    try {
      await apiJson(`/api/tasks/${taskId}`, { method: "DELETE" });
      setWorkspaceMessage("Task deleted.");
    } catch (error) {
      setEvents(previousEvents);
      setStandaloneTasks(previousTasks);
      setWorkspaceMessage(
        error instanceof Error ? error.message : "Could not delete task.",
      );
    } finally {
      markBusy(action, false);
    }
  }

  async function createCalendar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const action = "calendar:create";
    if (isBusy(action)) return;
    const name = calendarDraft.name.trim();
    if (!name || calendars.length >= 3) return;

    markBusy(action, true);
    try {
      const payload = await apiJson<{ calendar: DbCalendar }>(
        "/api/calendars",
        {
          method: "POST",
          body: JSON.stringify({ name, color: calendarDraft.color }),
        },
      );
      setCalendars((current) => [
        ...current,
        mapCalendar(payload.calendar, session),
      ]);
      setCalendarDraft({ name: "", color: "#007aff" });
      setWorkspaceMessage("Calendar created.");
    } catch (error) {
      setWorkspaceMessage(
        error instanceof Error ? error.message : "Could not create calendar.",
      );
    } finally {
      markBusy(action, false);
    }
  }

  function toggleCalendarVisibility(calendarId: string) {
    setCalendars((current) =>
      current.map((calendar) =>
        calendar.id === calendarId
          ? { ...calendar, visible: !calendar.visible }
          : calendar,
      ),
    );
  }

   async function addCalendarMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const action = "calendar:add-member";
    if (isBusy(action)) return;

    const email = memberDraft.email.trim().toLowerCase();
    if (!email) return;

    const selectedCalendar = calendars.find(
      (calendar) => calendar.id === memberDraft.calendarId,
    );

    const sharedCalendarUsed = calendars.some(
      (calendar) => calendar.shared && calendar.id !== memberDraft.calendarId,
    );

    if (!selectedCalendar || (!selectedCalendar.shared && sharedCalendarUsed)) {
      setWorkspaceMessage("Free plan allows one shared calendar.");
      return;
    }

    markBusy(action, true);

    try {
      const payload = await apiJson<{
        member: {
          id: string;
          userId?: string | null;
          email: string;
          displayName?: string | null;
          role: "owner" | "editor" | "viewer";
          status: "pending" | "accepted";
        };
        note?: string;
      }>(`/api/calendars/${memberDraft.calendarId}/members`, {
        method: "POST",
        body: JSON.stringify({ email, role: memberDraft.role }),
      });

      setCalendars((current) =>
        current.map((calendar) =>
          calendar.id === memberDraft.calendarId
            ? {
                ...calendar,
                shared: true,
                members: [
                  ...calendar.members.filter(
                    (member) => member.id !== payload.member.id,
                  ),
                  {
                    id: payload.member.id,
                    userId: payload.member.userId,
                    email: payload.member.email,
                    displayName: payload.member.displayName ?? undefined,
                    role: payload.member.role,
                    status: payload.member.status,
                  },
                ],
              }
            : calendar,
        ),
      );

      setMemberDraft((current) => ({ ...current, email: "" }));
      setWorkspaceMessage("Invite added.");
    } catch (error) {
      setWorkspaceMessage(
        error instanceof Error ? error.message : "Could not add invite.",
      );
    } finally {
      markBusy(action, false);
    }
  }

  async function updateCalendar(
    calendarId: string,
    updates: { name?: string; color?: string },
  ) {
    const action = `calendar:${calendarId}:update`;
    if (isBusy(action)) return;
    const previousCalendars = calendars;
    setCalendars((current) =>
      current.map((calendar) =>
        calendar.id === calendarId ? { ...calendar, ...updates } : calendar,
      ),
    );
    markBusy(action, true);
    try {
      const payload = await apiJson<{ calendar: DbCalendar }>(
        `/api/calendars/${calendarId}`,
        {
          method: "PATCH",
          body: JSON.stringify(updates),
        },
      );
      const updatedCalendar = mapCalendar(payload.calendar, session);
      setCalendars((current) =>
        current.map((calendar) =>
          calendar.id === calendarId ? updatedCalendar : calendar,
        ),
      );
      setWorkspaceMessage("Calendar saved.");
    } catch (error) {
      setCalendars(previousCalendars);
      setWorkspaceMessage(
        error instanceof Error ? error.message : "Could not update calendar.",
      );
    } finally {
      markBusy(action, false);
    }
  }

  async function deleteCalendar() {
    if (!deleteCalendarTarget) return;
    const action = `calendar:${deleteCalendarTarget.id}:delete`;
    if (isBusy(action)) return;
    const target = deleteCalendarTarget;
    const previousCalendars = calendars;
    const previousEvents = events;
    setDeleteCalendarTarget(null);
    setCalendars((current) =>
      current.filter((calendar) => calendar.id !== target.id),
    );
    setEvents((current) =>
      current.map((event) =>
        event.calendarId === target.id
          ? { ...event, status: "archived" }
          : event,
      ),
    );
    markBusy(action, true);
    try {
      await apiJson(`/api/calendars/${target.id}`, { method: "DELETE" });
      setWorkspaceMessage("Calendar deleted. Its events were archived.");
    } catch (error) {
      setCalendars(previousCalendars);
      setEvents(previousEvents);
      setWorkspaceMessage(
        error instanceof Error ? error.message : "Could not delete calendar.",
      );
    } finally {
      markBusy(action, false);
    }
  }

  async function updateCalendarMember(
    calendarId: string,
    memberId: string,
    role: "owner" | "editor" | "viewer",
  ) {
    const action = `calendar:${calendarId}:member:${memberId}:update`;
    if (isBusy(action)) return;

    if (
      role === "owner" &&
      !window.confirm(
        "Transfer ownership to this member? You will no longer be the owner.",
      )
    ) {
      return;
    }

    const previousCalendars = calendars;

    setCalendars((current) =>
      current.map((calendar) =>
        calendar.id === calendarId
          ? {
              ...calendar,
              members: calendar.members.map((member) =>
                member.id === memberId ? { ...member, role } : member,
              ),
            }
          : calendar,
      ),
    );

    markBusy(action, true);

    try {
      await apiJson(`/api/calendars/${calendarId}/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });

      if (role === "owner") {
        await loadWorkspace({
          message: "Ownership transferred.",
          showLoading: false,
        });
      } else {
        setWorkspaceMessage("Member permissions updated.");
      }
    } catch (error) {
      setCalendars(previousCalendars);
      setWorkspaceMessage(
        error instanceof Error ? error.message : "Could not update member.",
      );
    } finally {
      markBusy(action, false);
    }
  }

  async function removeCalendarMember(calendarId: string, memberId: string) {
    const action = `calendar:${calendarId}:member:${memberId}:remove`;
    if (isBusy(action)) return;

    if (!window.confirm("Remove this person from the calendar?")) return;

    const previousCalendars = calendars;

    setCalendars((current) =>
      current.map((calendar) =>
        calendar.id === calendarId
          ? {
              ...calendar,
              members: calendar.members.filter(
                (member) => member.id !== memberId,
              ),
            }
          : calendar,
      ),
    );

    markBusy(action, true);

    try {
      await apiJson(`/api/calendars/${calendarId}/members/${memberId}`, {
        method: "DELETE",
      });

      setWorkspaceMessage("Member removed.");
    } catch (error) {
      setCalendars(previousCalendars);
      setWorkspaceMessage(
        error instanceof Error ? error.message : "Could not remove member.",
      );
    } finally {
      markBusy(action, false);
    }
  }

  async function leaveSharedCalendar(calendar: AppCalendar) {
    const ownMember = calendar.members.find(
      (member) => member.userId === session?.user.id,
    );

    if (!ownMember) return;

    const action = `calendar:${calendar.id}:leave`;
    if (isBusy(action)) return;

    if (
      !window.confirm(
        `Leave "${calendar.name}"? It will no longer count toward your free calendar limit.`,
      )
    ) {
      return;
    }

    const previousCalendars = calendars;
    const previousEvents = events;

    setCalendars((current) =>
      current.filter((item) => item.id !== calendar.id),
    );

    setEvents((current) =>
      current.filter((event) => event.calendarId !== calendar.id),
    );

    markBusy(action, true);

    try {
      await apiJson(`/api/calendars/${calendar.id}/members/${ownMember.id}`, {
        method: "DELETE",
      });

      setWorkspaceMessage("You left the shared calendar.");
    } catch (error) {
      setCalendars(previousCalendars);
      setEvents(previousEvents);
      setWorkspaceMessage(
        error instanceof Error
          ? error.message
          : "Could not leave shared calendar.",
      );
    } finally {
      markBusy(action, false);
    }
  }

  async function respondToCalendarInvitation(
    invitationId: string,
    action: "accept" | "decline",
  ) {
    const busyKey = `calendar-invitation:${invitationId}:${action}`;
    if (isBusy(busyKey)) return;

    const invitation = calendarInvitations.find(
      (item) => item.id === invitationId,
    );

    markBusy(busyKey, true);

    try {
      await apiJson("/api/calendar-invitations", {
        method: "POST",
        body: JSON.stringify({ memberId: invitationId, action }),
      });

      setCalendarInvitations((current) =>
        current.filter((item) => item.id !== invitationId),
      );

      if (action === "accept" && invitation) {
        setCalendars((current) => [
          ...current.filter((calendar) => calendar.id !== invitation.calendar.id),
          mapCalendar(
            {
              ...invitation.calendar,
              members: invitation.calendar.members.map((member) =>
                member.id === invitationId
                  ? {
                      ...member,
                      userId: session?.user.id,
                      email: session?.user.email ?? member.email,
                      status: "accepted",
                    }
                  : member,
              ),
            },
            session,
          ),
        ]);

        setWorkspaceMessage("Shared calendar accepted.");
      } else {
        setWorkspaceMessage("Shared calendar declined.");
      }
    } catch (error) {
      setWorkspaceMessage(
        error instanceof Error
          ? error.message
          : "Could not update shared calendar invitation.",
      );
    } finally {
      markBusy(busyKey, false);
    }
  }

  async function saveProfileSettings() {
    setSettingsMessage("");
    setSettingsError("");
    try {
      const [profilePayload, notificationPayload] = await Promise.all([
        apiJson<{
          user: AppSession["user"] & {
            theme?: AppSettings["theme"];
            skipIntro?: boolean | null;
            plan?: "free" | "premium";
            premium?: boolean;
            premiumUntil?: string | null;
          };
        }>("/api/users/me", {
          method: "PATCH",
          body: JSON.stringify({
            name: settings.profile.accountName,
            theme: settings.theme,
            skipIntro: settings.skipIntro,
            calendarDisplayNames: settings.profile.calendarDisplayNames,
          }),
        }),
        apiJson<{ preferences: DbNotificationPreferences }>(
          "/api/settings/notifications",
          {
            method: "PATCH",
            body: JSON.stringify({
              eventReminders: settings.notifications.eventReminders,
              taskReminders: settings.notifications.taskReminders,
              dailyAgenda: settings.notifications.dailyAgenda,
              rescheduleReminders: settings.notifications.rescheduleReminders,
              birthdayReminders: settings.notifications.birthdayReminders,
              desktopNotifications: settings.notifications.desktopNotifications,
              mobileNotifications: settings.notifications.mobileNotifications,
              quietHoursEnabled: settings.notifications.quietHours,
              quietHoursStart: settings.notifications.quietStart,
              quietHoursEnd: settings.notifications.quietEnd,
              soundEnabled: settings.notifications.sound,
              vibrationEnabled: settings.notifications.vibration,
              defaultReminderMinutes: parseReminderMinutes(
                settings.notifications.defaultTiming,
              ),
              aiEnabled: settings.ai.enabled,
              aiScheduling: settings.ai.scheduling,
              aiInsights: settings.ai.insights,
              aiWeeklySummary: settings.ai.weeklySummary,
              privateMode: settings.ai.privateMode,
            }),
          },
        ),
      ]);

      const preferences = notificationPayload.preferences;
      const savedTheme = normalizeTheme(profilePayload.user.theme);
      const savedSkipIntro = profilePayload.user.skipIntro === true;
      const nextSettings = mapPreferencesToSettings(
        preferences,
        settings,
        {
          ...settings.profile,
          accountName: profilePayload.user.name ?? "",
        },
        savedTheme,
        savedSkipIntro,
      );

      setSettings(nextSettings);
      setSavedSettings(nextSettings);
      setCalendars((current) =>
        current.map((calendar) => ({
          ...calendar,
          members: calendar.members.map((member) =>
            member.userId === session?.user.id
              ? {
                  ...member,
                  displayName:
                    nextSettings.profile.calendarDisplayNames[calendar.id] ||
                    undefined,
                }
              : member,
          ),
        })),
      );
      applyDocumentTheme(nextSettings.theme, true);

      const changedSections = [
        JSON.stringify(settings.profile) !== JSON.stringify(savedSettings.profile) ||
        settings.skipIntro !== savedSettings.skipIntro
          ? "Profile"
          : null,
        settings.theme !== savedSettings.theme ? "Theme" : null,
        JSON.stringify(settings.notifications) !==
        JSON.stringify(savedSettings.notifications)
          ? "Notifications"
          : null,
        JSON.stringify(settings.ai) !== JSON.stringify(savedSettings.ai)
          ? "AI & privacy"
          : null,
      ].filter(Boolean);

      setSettingsMessage(
        changedSections.length > 0
          ? `${changedSections.join(", ")} saved.`
          : "Settings saved.",
      );
    } catch (error) {
      setSettingsError(
        error instanceof Error ? error.message : "Could not save settings.",
      );
    }
  }

  async function skipIntroFromModal() {
    if (introSaving) return;

    setIntroSaving(true);
    try {
      const payload = await apiJson<{
        user: AppSession["user"] & {
          theme?: AppSettings["theme"];
          skipIntro?: boolean | null;
          plan?: "free" | "premium";
          premium?: boolean;
          premiumUntil?: string | null;
        };
      }>("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify({ skipIntro: true }),
      });
      const nextSkipIntro = payload.user.skipIntro === true;
      setSettings((current) => ({ ...current, skipIntro: nextSkipIntro }));
      setSavedSettings((current) => ({ ...current, skipIntro: nextSkipIntro }));
      setIntroOpen(false);
      setSettingsMessage(
        "Intro skipped. You can turn it back on from Settings.",
      );
    } catch (error) {
      setWorkspaceMessage(
        error instanceof Error
          ? error.message
          : "Could not update intro setting.",
      );
    } finally {
      setIntroSaving(false);
    }
  }

  async function requestAccountDeletion() {
    if (deleteAccountText !== "DELETE") return;
    try {
      await apiJson("/api/users/me", { method: "DELETE" });
    } catch (error) {
      setSettingsError(
        error instanceof Error
          ? error.message
          : "Account deletion is not configured yet.",
      );
    }
  }

  function shareEvent(eventId: string) {
    const email = shareDrafts[eventId]?.trim().toLowerCase();
    if (!email) return;

    setEvents((current) =>
      current.map((event) =>
        event.id === eventId
          ? {
              ...event,
              sharedWith: [
                ...(event.sharedWith ?? []),
                { id: createId(), email, role: "viewer", status: "pending" },
              ],
              activity: [
                ...(event.activity ?? []),
                {
                  id: createId(),
                  text: `Share prepared for ${email}`,
                  at: new Date().toISOString(),
                },
              ],
            }
          : event,
      ),
    );
    setShareDrafts((current) => ({ ...current, [eventId]: "" }));
  }

  function updateNotificationSetting(
    key: keyof AppSettings["notifications"],
    value: boolean | string,
  ) {
    if (
      (key === "desktopNotifications" || key === "mobileNotifications") &&
      value === true
    ) {
      void subscribeToPushNotifications();
    }
    setSettings((current) => ({
      ...current,
      notifications: { ...current.notifications, [key]: value },
    }));
  }

  function updateAiSetting(key: keyof AiSettings, value: boolean) {
    setSettings((current) => ({
      ...current,
      ai: { ...current.ai, [key]: value },
    }));
  }

  function selectSettingsSection(section: SettingsSectionId) {
    setActiveSettingsSection(section);
    window.setTimeout(() => {
      document.getElementById(`settings-${section}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  async function createTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = tagDraft.label.trim();
    if (!label) return;

    try {
      const payload = await apiJson<{ category: DbCategory }>(
        "/api/categories",
        {
          method: "POST",
          body: JSON.stringify({
            name: label,
            icon: tagDraft.icon.trim() || "tag",
            color: tagDraft.color,
          }),
        },
      );
      const newTag = mapCategory(payload.category);
      setTags((current) => [...current, newTag]);
      setDraft((current) => ({ ...current, category: newTag.id }));
      setActiveCategory(newTag.id);
      setTagDraft({ label: "", icon: "tag", color: "#007aff" });
      setTagModalOpen(false);
    } catch (error) {
      setWorkspaceMessage(
        error instanceof Error ? error.message : "Could not create category.",
      );
    }
  }

  if (!isAuthed) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[var(--background)] px-6 text-[var(--foreground)]">
        <section className="w-full max-w-md rounded-[30px] border border-[var(--border-soft)] bg-[var(--surface)] p-6 text-center shadow-xl shadow-[var(--shadow-soft)] backdrop-blur-2xl">
          <div className="mx-auto grid size-14 place-items-center rounded-3xl bg-[var(--accent)] text-white shadow-lg shadow-[var(--shadow-soft)]">
            <CalendarDays size={25} />
          </div>
          <h1 className="mt-4 text-2xl font-black">Login required</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted)]">
            Your calendar is private. Log in to continue, or create an account
            if you are new here.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <a
              type="button"
              href="/login"
              className="flex h-12 items-center justify-center rounded-full bg-[var(--accent)] px-5 text-sm font-black text-white shadow-lg shadow-[var(--shadow-soft)] active:scale-95"
            >
              Log in
            </a>
            <a
              type="button"
              href="/signup"
              className="flex h-12 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface-strong)] px-5 text-sm font-black text-[var(--foreground)] active:scale-95"
            >
              Sign up
            </a>
          </div>
        </section>
      </main>
    );
  }

  if (isAuthed && !workspaceReady) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[var(--background)] px-6 text-[var(--foreground)]">
        <section className="flex w-full max-w-xs flex-col items-center rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface)] px-6 py-7 text-center shadow-xl shadow-[var(--shadow-soft)] backdrop-blur-2xl">
          <div className="relative grid size-12 place-items-center rounded-2xl bg-[var(--accent)] text-white shadow-lg shadow-[var(--shadow-soft)]">
            <CalendarDays size={23} />
            <span className="absolute inset-0 rounded-2xl border border-white/20" />
          </div>

          <div className="mt-5 flex items-center gap-2">
            <span className="size-2 animate-pulse rounded-full bg-[var(--accent)]" />
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--muted)]">
              Loading workspace
            </p>
          </div>

          <h1 className="mt-2 text-2xl font-black tracking-tight text-[var(--foreground)]">
            Preparing Arcgenda
          </h1>
          <p className="mt-2 max-w-[240px] text-sm font-semibold leading-6 text-[var(--muted)]">
            Fetching your saved theme, calendars, events, and tasks.
          </p>

          <div
            className="mt-6 flex items-center justify-center gap-1.5"
            aria-label="Loading"
          >
            <span className="size-2 animate-bounce rounded-full bg-[var(--accent)]" />
            <span className="size-2 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:120ms]" />
            <span className="size-2 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:240ms]" />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="arcgenda-app h-dvh overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-[-80px] size-72 rounded-full bg-[#ff9bd2]/50 blur-3xl" />
        <div className="absolute right-[-90px] top-28 size-72 rounded-full bg-[#7dd3fc]/55 blur-3xl" />
        <div className="absolute bottom-[-120px] left-12 size-80 rounded-full bg-[#fef08a]/45 blur-3xl" />
      </div>

      <div className="relative mx-auto grid h-dvh w-full max-w-md overflow-hidden bg-[var(--app-shell)] shadow-2xl shadow-[#6d5dfc]/15 backdrop-blur-3xl lg:max-w-7xl lg:grid-cols-[430px_1fr] lg:gap-6 lg:bg-transparent lg:p-6 lg:shadow-none">
        <section className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[var(--app-shell)] backdrop-blur-3xl lg:h-[calc(100dvh-48px)] lg:rounded-[36px] lg:border lg:border-[var(--border-soft)]">
          <Header
            today={today}
            activeTab={activeTab}
            activeSettingsSection={activeSettingsSection}
            onSettingsSectionChange={selectSettingsSection}
            query={query}
            setQuery={setQuery}
            onAdd={openNewItem}
            onLogout={() => {
              void logout("/login");
            }}
          />
          <section className="min-h-0 flex-1 scroll-pb-40 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+176px)] pt-5 lg:pb-6 lg:scroll-pb-6">
            {activeTab === "calendar" && (
              <>
                <ViewSwitcher view={view} setView={setView} />
                <CalendarControls
                  visibleMonth={visibleMonth}
                  filteredCount={filteredEvents.length}
                  onMove={movePeriod}
                />
                <TagFilters
                  tags={tags}
                  activeCategory={activeCategory}
                  setActiveCategory={setActiveCategory}
                  onAddTag={() => setTagModalOpen(true)}
                />
                <CalendarStrip
                  calendars={calendars}
                  onToggle={toggleCalendarVisibility}
                />
                {view === "month" && (
                  <MonthView
                    days={monthDays}
                    events={filteredEvents}
                    selectedDate={selectedDate}
                    today={today}
                    tagFor={tagFor}
                    onSelect={selectDate}
                  />
                )}
                {view === "week" && (
                  <WeekView
                    days={weekDays}
                    events={filteredEvents}
                    selectedDate={selectedDate}
                    tagFor={tagFor}
                    onSelect={selectDate}
                  />
                )}
                {view === "day" && (
                  <DayTimeline
                    selectedDate={selectedDate}
                    events={selectedEvents}
                    tagFor={tagFor}
                    onEdit={openEditEvent}
                  />
                )}
                <Agenda
                  selectedDate={selectedDate}
                  events={selectedEvents}
                  reminders={selectedReminders}
                  tagFor={tagFor}
                  onEdit={openEditEvent}
                  onCancel={(event) => {
                    setCancelTarget(event);
                    setCancellationReason(event.cancellationReason ?? "");
                    setCancelScope("series-cancel");
                  }}
                  onDelete={deleteEvent}
                  onUndoCancel={undoCancelEvent}
                  unboundTasks={unboundUndoneTasks}
                  taskDrafts={eventTaskDrafts}
                  setTaskDrafts={setEventTaskDrafts}
                  onCreateTask={createTaskForEvent}
                  onLinkTask={linkTaskToEvent}
                  onToggleTask={toggleTask}
                  onUnlinkTask={unlinkTaskFromEvent}
                  onDeleteTask={deleteTask}
                  onEditTask={editTaskTitle}
                  calendars={calendars}
                  shareDrafts={shareDrafts}
                  setShareDrafts={setShareDrafts}
                  onShareEvent={shareEvent}
                />
              </>
            )}
            {activeTab === "tasks" && (
                            <TasksTab
                tasks={searchedVisibleTaskItems}
                taskView={taskView}
                setTaskView={setTaskView}
                title={taskViewTitle}
                onToggle={toggleTask}
                onDelete={deleteTask}
                onEdit={editTaskTitle}
              />
            )}
                        {activeTab === "alerts" && (
              <AlertsTab
                alerts={searchedAllAlertItems}
                calendarInvitations={calendarInvitations}
                onCalendarInvitationResponse={respondToCalendarInvitation}
              />
            )}
            {activeTab === "stats" && (
              <StatsTab
                stats={stats}
                statsRange={statsContext.range}
                setStatsRange={setStatsRange}
                statsPeriodLabel={statsContext.label}
                isPremium={isPremium}
                aiSuggestions={aiSuggestions}
                aiEnabled={settings.ai.enabled}
              />
            )}
            {activeTab === "settings" && (
              <div className="lg:hidden">
                <SettingsTab
                  session={session}
                  calendars={calendars}
                  workspaceLoading={workspaceLoading}
                  workspaceMessage={workspaceMessage}
                  settingsMessage={settingsMessage}
                  settingsError={settingsError}
                  calendarDraft={calendarDraft}
                  setCalendarDraft={setCalendarDraft}
                  onCreateCalendar={createCalendar}
                  onUpdateCalendar={updateCalendar}
                  onAskDeleteCalendar={setDeleteCalendarTarget}
                  onUpdateMember={updateCalendarMember}
                  onRemoveMember={removeCalendarMember}
                  onLeaveCalendar={leaveSharedCalendar}
                  memberDraft={memberDraft}
                  setMemberDraft={setMemberDraft}
                  onAddMember={addCalendarMember}
                  settings={settings}
                  setSettings={setSettings}
                  savedSettings={savedSettings}
                  notificationPermission={notificationPermission}
                  pushStatus={pushStatus}
                  pushConfigured={pushConfigured}
                  pushSubscribed={pushSubscribed}
                  cronConfigured={cronConfigured}
                  notificationCapabilities={notificationCapabilities}
                  notificationActionMessage={notificationActionMessage}
                  isMobileDevice={isMobileDevice}
                  canVibrate={canVibrate}
                  activeSection={activeSettingsSection}
                  onSectionChange={selectSettingsSection}
                  onNotificationChange={updateNotificationSetting}
                  onRequestNotifications={() =>
                    void subscribeToPushNotifications()
                  }
                  onUnsubscribeNotifications={() =>
                    void unsubscribeFromPushNotifications()
                  }
                  onTestNotification={() => void sendTestNotification()}
                  onAiChange={updateAiSetting}
                  onSaveSettings={saveProfileSettings}
                  onRevertSettings={revertUnsavedSettings}
                  onOpenDeleteAccount={() => setDeleteAccountOpen(true)}
                />
              </div>
            )}
          </section>
          <BottomTabs
            activeTab={activeTab}
            setActiveTab={(tab) => {
              setActiveTab(tab);
              if (tab === "alerts") {
                setAlertsSeen(true);
              }
            }}
            hasNewAlerts={hasNewAlerts}
          />
        </section>

        <aside className="hidden min-h-[calc(100dvh-48px)] grid-rows-[auto_1fr] gap-6 overflow-y-auto lg:grid">
          {activeTab === "settings" ? (
            <SettingsTab
              session={session}
              calendars={calendars}
              workspaceLoading={workspaceLoading}
              workspaceMessage={workspaceMessage}
              settingsMessage={settingsMessage}
              settingsError={settingsError}
              calendarDraft={calendarDraft}
              setCalendarDraft={setCalendarDraft}
              onCreateCalendar={createCalendar}
              onUpdateCalendar={updateCalendar}
              onAskDeleteCalendar={setDeleteCalendarTarget}
              onUpdateMember={updateCalendarMember}
              onRemoveMember={removeCalendarMember}
              onLeaveCalendar={leaveSharedCalendar}
              memberDraft={memberDraft}
              setMemberDraft={setMemberDraft}
              onAddMember={addCalendarMember}
              settings={settings}
              setSettings={setSettings}
              savedSettings={savedSettings}
              notificationPermission={notificationPermission}
              pushStatus={pushStatus}
              pushConfigured={pushConfigured}
              pushSubscribed={pushSubscribed}
              cronConfigured={cronConfigured}
              notificationCapabilities={notificationCapabilities}
              notificationActionMessage={notificationActionMessage}
              isMobileDevice={isMobileDevice}
              canVibrate={canVibrate}
              activeSection={activeSettingsSection}
              onSectionChange={selectSettingsSection}
              onNotificationChange={updateNotificationSetting}
              onRequestNotifications={() => void subscribeToPushNotifications()}
              onUnsubscribeNotifications={() =>
                void unsubscribeFromPushNotifications()
              }
              onTestNotification={() => void sendTestNotification()}
              onAiChange={updateAiSetting}
              onSaveSettings={saveProfileSettings}
              onRevertSettings={revertUnsavedSettings}
              onOpenDeleteAccount={() => setDeleteAccountOpen(true)}
            />
          ) : (
            <DesktopPanel
              selectedDate={selectedDate}
              events={selectedEvents}
              reminders={selectedReminders}
              tasks={searchedTaskItems}
              alerts={searchedAlertItems}
            />
          )}
        </aside>
      </div>

      {composerOpen && (
        <EventComposer
          draft={draft}
          editing={Boolean(editingId)}
          kind={composerKind}
          setKind={setComposerKind}
          tags={tags}
          calendars={calendars}
          events={events}
          unboundTasks={unboundUndoneTasks}
          selectedTaskIds={selectedTaskIds}
          setSelectedTaskIds={setSelectedTaskIds}
          taskDraft={taskDraft}
          setTaskDraft={setTaskDraft}
          reminderDraft={eventReminderDraft}
          setReminderDraft={setEventReminderDraft}
          onChange={setDraft}
          onClose={() => setComposerOpen(false)}
          onSubmit={saveEvent}
          onSubmitTask={saveTask}
          onAddTag={() => setTagModalOpen(true)}
          submitting={composerSubmitting}
        />
      )}
      {tagModalOpen && (
        <TagModal
          draft={tagDraft}
          setDraft={setTagDraft}
          onClose={() => setTagModalOpen(false)}
          onSubmit={createTag}
        />
      )}
      {cancelTarget && (
        <CancelEventModal
          event={cancelTarget}
          reason={cancellationReason}
          scope={cancelScope}
          onReasonChange={setCancellationReason}
          onScopeChange={setCancelScope}
          onClose={() => setCancelTarget(null)}
          onConfirm={confirmCancelEvent}
        />
      )}
      {rescheduleTarget && (
        <RescheduleReminderModal
          event={rescheduleTarget}
          draft={rescheduleDraft}
          onChange={setRescheduleDraft}
          onClose={() => setRescheduleTarget(null)}
          onCreate={createRescheduleReminder}
        />
      )}
      {introOpen && (
        <IntroModal
          accountName={
            settings.profile.accountName ||
            session?.user.name ||
            session?.user.email ||
            "there"
          }
          selectedDate={selectedDate}
          todayEvents={selectedEvents}
          todayTasks={searchedTaskItems}
          alerts={searchedAlertItems}
          onClose={() => setIntroOpen(false)}
          onSkipNextTime={skipIntroFromModal}
          saving={introSaving}
        />
      )}
      {deleteCalendarTarget && (
        <ConfirmModal
          title="Are you sure you want to delete this calendar?"
          body={`"${deleteCalendarTarget.name}" will be deleted and its events will be archived by the API. This cannot be undone from this screen.`}
          confirmLabel="Delete calendar"
          danger
          onClose={() => setDeleteCalendarTarget(null)}
          onConfirm={deleteCalendar}
        />
      )}
      {deleteAccountOpen && (
        <DeleteAccountModal
          value={deleteAccountText}
          onChange={setDeleteAccountText}
          onClose={() => {
            setDeleteAccountOpen(false);
            setDeleteAccountText("");
          }}
          onConfirm={requestAccountDeletion}
        />
      )}
      <ToastViewport toasts={toasts} onClose={removeToast} />
    </main>
  );
}

function Header({
  today,
  activeTab,
  activeSettingsSection,
  onSettingsSectionChange,
  query,
  setQuery,
  onAdd,
  onLogout,
}: {
  today: Date;
  activeTab: AppTab;
  activeSettingsSection: SettingsSectionId;
  onSettingsSectionChange: (section: SettingsSectionId) => void;
  query: string;
  setQuery: (query: string) => void;
  onAdd: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/45 bg-white/55 px-5 pb-4 pt-[calc(env(safe-area-inset-top)+14px)] backdrop-blur-2xl lg:rounded-t-[36px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandMark size="md" />
          <div>
            <p className="text-sm font-semibold text-[#7c7c8a]">
              {formatLongDate(today)}
            </p>
            <h1 className="text-3xl font-semibold tracking-normal">Arcgenda</h1>
          </div>
        </div>
        <button
          className="grid size-11 place-items-center rounded-full bg-[#1d1d1f] text-white shadow-lg shadow-black/20 transition active:scale-95"
          onClick={onAdd}
          aria-label={activeTab === "tasks" ? "Add task" : "Add event"}
        >
          <CirclePlus size={23} strokeWidth={2.5} />
        </button>
      </div>
      <button
        onClick={onLogout}
        className="mt-4 inline-flex h-9 items-center rounded-full bg-white/70 px-4 text-sm font-bold text-[#ff3b30] shadow-sm"
      >
        Log out
      </button>

      {activeTab === "settings" ? (
        <nav className="mt-5 rounded-[26px] border border-white/65 bg-white/62 p-2 shadow-sm backdrop-blur-xl lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="mb-2 px-2 lg:px-0">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-[#8e8e93]">
              Settings
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {settingsNavigation.map((item) => {
              const selected = activeSettingsSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSettingsSectionChange(item.id)}
                  className={[
                    "shrink-0 rounded-full px-3 py-2 text-left text-xs font-black transition active:scale-95 lg:flex lg:w-full lg:items-center lg:justify-between lg:rounded-2xl lg:px-4 lg:py-3",
                    selected
                      ? "bg-[#1d1d1f] text-white shadow-lg shadow-black/15"
                      : "bg-white/75 text-[#007aff] shadow-sm",
                  ].join(" ")}
                >
                  <span>{item.label}</span>
                  {selected && (
                    <span className="hidden size-2 rounded-full bg-[#7dd3fc] lg:block" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      ) : (
        <label className="mt-5 flex h-11 items-center gap-2 rounded-full border border-white/65 bg-white/70 px-4 text-[#7c7c8a] shadow-sm backdrop-blur-xl">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#1d1d1f] outline-none placeholder:text-[#9b9baa]"
            placeholder="Search events, notes, places"
          />
        </label>
      )}
    </header>
  );
}

function ViewSwitcher({
  view,
  setView,
}: {
  view: CalendarView;
  setView: (view: CalendarView) => void;
}) {
  return (
    <div className="mb-4 grid grid-cols-3 rounded-full bg-white/55 p-1 text-sm font-semibold shadow-inner shadow-black/5">
      {viewOptions.map((option) => (
        <button
          key={option}
          onClick={() => setView(option)}
          className={[
            "h-9 rounded-full capitalize transition",
            view === option
              ? "bg-white text-[#007aff] shadow-sm"
              : "text-[#7c7c8a]",
          ].join(" ")}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function CalendarControls({
  visibleMonth,
  filteredCount,
  onMove,
}: {
  visibleMonth: Date;
  filteredCount: number;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <button
        className="nav-circle"
        onClick={() => onMove(-1)}
        aria-label="Previous period"
      >
        <ChevronLeft size={21} strokeWidth={2.6} />
      </button>
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-normal">
          {formatMonthYear(visibleMonth)}
        </h2>
        <p className="text-sm font-semibold text-[#7c7c8a]">
          {filteredCount} planned moments
        </p>
      </div>
      <button
        className="nav-circle"
        onClick={() => onMove(1)}
        aria-label="Next period"
      >
        <ChevronRight size={21} strokeWidth={2.6} />
      </button>
    </div>
  );
}

function TagFilters({
  tags,
  activeCategory,
  setActiveCategory,
  onAddTag,
}: {
  tags: CategoryStyle[];
  activeCategory: string | "all";
  setActiveCategory: (category: string | "all") => void;
  onAddTag: () => void;
}) {
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
      <button
        onClick={() => setActiveCategory("all")}
        className={[
          "shrink-0 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition active:scale-95",
          activeCategory === "all"
            ? "bg-[#1d1d1f] text-white"
            : "bg-white/70 text-[#7c7c8a]",
        ].join(" ")}
      >
        All
      </button>
      {tags.map((tag) => (
        <button
          key={tag.id}
          onClick={() => setActiveCategory(tag.id)}
          className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition active:scale-95"
          style={{
            background:
              activeCategory === tag.id
                ? `${tag.color}24`
                : "rgba(255,255,255,.7)",
            color: activeCategory === tag.id ? tag.color : "#7c7c8a",
          }}
        >
          {tag.label}
        </button>
      ))}
      <button
        className="grid size-9 shrink-0 place-items-center rounded-full bg-white/70 text-[#007aff] shadow-sm"
        onClick={onAddTag}
        aria-label="Add tag"
      >
        <Palette size={18} />
      </button>
    </div>
  );
}

function MonthView({
  days,
  events,
  selectedDate,
  today,
  tagFor,
  onSelect,
}: {
  days: ReturnType<typeof getMonthDays>;
  events: CalendarEvent[];
  selectedDate: Date;
  today: Date;
  tagFor: (event: CalendarEvent) => CategoryStyle;
  onSelect: (date: Date) => void;
}) {
  return (
    <section className="rounded-[28px] border border-white/60 bg-white/62 p-3 shadow-xl shadow-[#8173ff]/10 backdrop-blur-2xl">
      <div className="grid grid-cols-7 pb-2 text-center text-xs font-bold text-[#8e8e93]">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6 gap-1">
        {days.map((day) => {
          const dayEvents = events.filter((event) => event.date === day.key);
          const selected = sameDate(day.date, selectedDate);
          const isToday = sameDate(day.date, today);
          return (
            <button
              key={day.key}
              onClick={() => onSelect(day.date)}
              className={[
                "mx-auto flex aspect-square w-full max-w-12 flex-col items-center justify-center rounded-2xl text-sm font-bold transition active:scale-95",
                selected
                  ? "bg-[#1d1d1f] text-white shadow-lg shadow-black/20"
                  : isToday
                    ? "bg-white text-[#007aff] shadow-sm"
                    : day.currentMonth
                      ? "text-[#27272a]"
                      : "text-[#c7c7cc]",
              ].join(" ")}
            >
              <span>{day.label}</span>
              <span className="mt-1 flex h-1.5 max-w-8 gap-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <span
                    key={event.id}
                    className={[
                      "size-1.5 rounded-full",
                      event.status === "cancelled" ? "opacity-35" : "",
                    ].join(" ")}
                    style={{ backgroundColor: tagFor(event).color }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function WeekView({
  days,
  events,
  selectedDate,
  tagFor,
  onSelect,
}: {
  days: Date[];
  events: CalendarEvent[];
  selectedDate: Date;
  tagFor: (event: CalendarEvent) => CategoryStyle;
  onSelect: (date: Date) => void;
}) {
  return (
    <section className="grid grid-cols-7 gap-2">
      {days.map((day) => {
        const dayKey = toDateKey(day);
        const dayEvents = events.filter((event) => event.date === dayKey);
        const selected = sameDate(day, selectedDate);
        return (
          <button
            key={dayKey}
            onClick={() => onSelect(day)}
            className={[
              "min-h-28 rounded-[24px] border border-white/60 p-2 text-left shadow-lg backdrop-blur-2xl transition active:scale-95",
              selected
                ? "bg-[#1d1d1f] text-white"
                : "bg-white/62 text-[#27272a]",
            ].join(" ")}
          >
            <span className="block text-xs font-bold uppercase opacity-70">
              {new Intl.DateTimeFormat("en", { weekday: "short" }).format(day)}
            </span>
            <span className="mt-1 block text-xl font-semibold">
              {day.getDate()}
            </span>
            <span className="mt-3 flex flex-col gap-1">
              {dayEvents.slice(0, 3).map((event) => (
                <span
                  key={event.id}
                  className="h-1.5 rounded-full"
                  style={{ backgroundColor: tagFor(event).color }}
                />
              ))}
            </span>
          </button>
        );
      })}
    </section>
  );
}

function DayTimeline({
  selectedDate,
  events,
  tagFor,
  onEdit,
}: {
  selectedDate: Date;
  events: CalendarEvent[];
  tagFor: (event: CalendarEvent) => CategoryStyle;
  onEdit: (event: CalendarEvent) => void;
}) {
  return (
    <section className="rounded-[28px] border border-white/60 bg-white/62 p-4 shadow-xl shadow-[#8173ff]/10 backdrop-blur-2xl">
      <p className="text-sm font-bold text-[#8e8e93]">
        {formatLongDate(selectedDate)}
      </p>
      <div className="relative mt-4 space-y-3">
        {timelineSlots.map((slot) => (
          <div key={slot} className="grid grid-cols-[54px_1fr] gap-3">
            <span className="pt-1 text-xs font-bold text-[#9b9baa]">
              {slot}
            </span>
            <div className="min-h-12 border-t border-dashed border-[#d9d9e3]" />
          </div>
        ))}
        {events.map((event) => {
          const tag = tagFor(event);
          const top = Math.max(0, (hourFromTime(event.time) - 8) * 60 + 22);
          return (
            <button
              key={event.id}
              onClick={() => onEdit(event)}
              className={[
                "absolute left-[66px] right-1 rounded-2xl border border-white/70 p-3 text-left shadow-lg backdrop-blur-xl transition active:scale-95",
                event.status === "cancelled" ? "opacity-55" : "",
              ].join(" ")}
              style={{ top, background: `${tag.color}26` }}
            >
              <span className="flex items-center justify-between gap-2">
                <span
                  className={[
                    "truncate text-sm font-bold",
                    event.status === "cancelled" ? "line-through" : "",
                  ].join(" ")}
                >
                  {event.title}
                </span>
                <span
                  className="text-xs font-bold"
                  style={{ color: tag.color }}
                >
                  {event.time}
                </span>
              </span>
              <span className="mt-1 block truncate text-xs font-semibold text-[#636366]">
                {event.location}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Agenda({
  selectedDate,
  events,
  reminders,
  tagFor,
  onEdit,
  onCancel,
  onDelete,
  onEditTask,
  onUndoCancel,
  unboundTasks,
  taskDrafts,
  setTaskDrafts,
  onCreateTask,
  onLinkTask,
  onToggleTask,
  onUnlinkTask,
  onDeleteTask,
  calendars,
  shareDrafts,
  setShareDrafts,
  onShareEvent,
}: {
  selectedDate: Date;
  events: CalendarEvent[];
  reminders: RescheduleReminder[];
  tagFor: (event: CalendarEvent) => CategoryStyle;
  onEdit: (event: CalendarEvent) => void;
  onCancel: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
  onUndoCancel: (id: string) => void;
  unboundTasks: StandaloneTask[];
  taskDrafts: Record<string, string>;
  setTaskDrafts: (drafts: Record<string, string>) => void;
  onCreateTask: (eventId: string) => void;
  onLinkTask: (eventId: string, taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onUnlinkTask: (eventId: string, taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (taskId: string, currentTitle: string) => void;
  calendars: AppCalendar[];
  shareDrafts: Record<string, string>;
  setShareDrafts: (drafts: Record<string, string>) => void;
  onShareEvent: (eventId: string) => void;
}) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-[#8e8e93]">Agenda</p>
          <h3 className="text-xl font-semibold tracking-normal">
            {formatLongDate(selectedDate)}
          </h3>
        </div>
        <span className="rounded-full bg-white/70 px-3 py-1 text-sm font-bold text-[#007aff] shadow-sm">
          {events.length} events
        </span>
      </div>
      <div className="space-y-3">
        {events.length === 0 ? (
          <EmptyState
            title="Nothing scheduled"
            body="Add an event or switch filters to see more."
          />
        ) : (
          events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              tag={tagFor(event)}
              onEdit={() => onEdit(event)}
              onCancel={() => onCancel(event)}
              onDelete={() => onDelete(event.id)}
              onEditTask={onEditTask}
              onUndoCancel={() => onUndoCancel(event.id)}
              unboundTasks={unboundTasks}
              taskDraft={taskDrafts[event.id] ?? ""}
              onTaskDraftChange={(value) =>
                setTaskDrafts({ ...taskDrafts, [event.id]: value })
              }
              onCreateTask={() => onCreateTask(event.id)}
              onLinkTask={(taskId) => onLinkTask(event.id, taskId)}
              onToggleTask={onToggleTask}
              onUnlinkTask={(taskId) => onUnlinkTask(event.id, taskId)}
              onDeleteTask={onDeleteTask}
              calendar={calendars.find(
                (calendar) => calendar.id === (event.calendarId ?? "personal"),
              )}
              shareDraft={shareDrafts[event.id] ?? ""}
              onShareDraftChange={(value) =>
                setShareDrafts({ ...shareDrafts, [event.id]: value })
              }
              onShare={() => onShareEvent(event.id)}
            />
          ))
        )}
        {reminders.map((reminder) => (
          <ReminderCard key={reminder.id} reminder={reminder} />
        ))}
      </div>
    </section>
  );
}

function EventCard({
  event,
  tag,
  onEdit,
  onCancel,
  onDelete,
  onEditTask,
  onUndoCancel,
  unboundTasks,
  taskDraft,
  onTaskDraftChange,
  onCreateTask,
  onLinkTask,
  onToggleTask,
  onUnlinkTask,
  onDeleteTask,
  calendar,
  shareDraft,
  onShareDraftChange,
  onShare,
}: {
  event: CalendarEvent;
  tag: CategoryStyle;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onEditTask: (taskId: string, currentTitle: string) => void;
  onUndoCancel: () => void;
  unboundTasks: StandaloneTask[];
  taskDraft: string;
  onTaskDraftChange: (value: string) => void;
  onCreateTask: () => void;
  onLinkTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onUnlinkTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  calendar?: AppCalendar;
  shareDraft: string;
  onShareDraftChange: (value: string) => void;
  onShare: () => void;
}) {
  const doneTasks = event.tasks.filter((task) => task.done).length;
  const cancelled = event.status === "cancelled";

  return (
    <article
      className={[
        "event-card-shell rounded-[28px] p-4 shadow-xl shadow-black/5 ring-1 ring-white/70 transition",
        cancelled ? "opacity-60 grayscale-[0.25]" : "",
      ].join(" ")}
      style={{
        background: `linear-gradient(135deg, ${tag.color}22, rgba(255,255,255,.78))`,
      }}
    >
      <div className="flex gap-3">
        <div
          className="mt-1 h-14 w-1.5 rounded-full"
          style={{ backgroundColor: tag.color }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {event.pinned && <Pin size={14} className="text-[#ff9500]" />}
                <h4
                  className={[
                    "truncate text-base font-semibold",
                    cancelled ? "line-through decoration-2" : "",
                  ].join(" ")}
                >
                  {event.title}
                </h4>
                {cancelled && (
                  <span className="shrink-0 rounded-full bg-[#ffe8e6] px-2 py-0.5 text-[11px] font-bold uppercase text-[#c82d21]">
                    Cancelled
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm font-semibold text-[#7c7c8a]">
                {calendar?.name ?? "Personal"} ·{" "}
                {event.recurrence === "none" ? "One-time" : event.recurrence} ·{" "}
                {event.priority} priority
              </p>
              <p className="mt-1 text-xs font-bold text-[#8e8e93]">
                Created by {event.createdBy ?? "you"} · Last edited by{" "}
                {event.lastEditedBy ?? "you"}
              </p>
              {cancelled && event.cancellationReason && (
                <p className="mt-2 text-sm font-semibold text-[#8a5a55]">
                  Reason: {event.cancellationReason}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              {cancelled ? (
                <IconButton
                  label={`Undo cancellation for ${event.title}`}
                  onClick={onUndoCancel}
                >
                  <RotateCcw size={15} />
                </IconButton>
              ) : (
                <>
                  <IconButton label={`Edit ${event.title}`} onClick={onEdit}>
                    <Edit3 size={15} />
                  </IconButton>
                  <IconButton
                    label={`Cancel ${event.title}`}
                    onClick={onCancel}
                    danger
                  >
                    <CircleX size={16} />
                  </IconButton>
                </>
              )}
              <IconButton
                label={`Delete ${event.title}`}
                onClick={onDelete}
                danger
              >
                <Trash2 size={15} />
              </IconButton>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold text-[#636366]">
            <Chip
              icon={<Clock3 size={14} />}
              text={`${event.time} · ${event.duration}`}
            />
            <Chip icon={<MapPin size={14} />} text={event.location} />
            {event.tasks.length > 0 && (
              <Chip
                icon={<Check size={14} />}
                text={`${doneTasks}/${event.tasks.length}`}
              />
            )}
            {event.rescheduleReminders.length > 0 && (
              <Chip
                icon={<RotateCcw size={14} />}
                text={`${event.rescheduleReminders.length} reschedule`}
              />
            )}
          </div>
          <div className="mt-4 rounded-3xl bg-white/55 p-3 backdrop-blur">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-[#636366]">Linked tasks</p>
              {cancelled && (
                <span className="rounded-full bg-[#ffe8e6] px-2 py-0.5 text-[11px] font-bold text-[#c82d21]">
                  Event cancelled
                </span>
              )}
            </div>
            {event.tasks.length === 0 ? (
              <p className="text-sm font-semibold text-[#8e8e93]">
                No linked tasks yet.
              </p>
            ) : (
              <div className="space-y-2">
                {event.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-2xl bg-white/70 px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => onToggleTask(task.id)}
                      className={[
                        "grid size-7 place-items-center rounded-full transition active:scale-95",
                        task.done
                          ? "bg-[#34c759] text-white"
                          : "bg-[#f2f2f7] text-transparent",
                      ].join(" ")}
                      aria-label={`Toggle ${task.title}`}
                    >
                      <Check size={14} />
                    </button>
                    <div className="min-w-0">
                      <p
                        className={[
                          "truncate text-sm font-semibold",
                          task.done ? "line-through text-[#8e8e93]" : "",
                        ].join(" ")}
                      >
                        {task.title}
                      </p>
                      {cancelled && (
                        <p className="truncate text-xs font-bold text-[#c82d21]">
                          Linked event is cancelled
                        </p>
                      )}
                    </div>
                                        <div className="flex gap-1">
                      <IconButton
                        label={`Edit ${task.title}`}
                        onClick={() => onEditTask(task.id, task.title)}
                      >
                        <Edit3 size={14} />
                      </IconButton>
                      <IconButton
                        label={`Unlink ${task.title}`}
                        onClick={() => onUnlinkTask(task.id)}
                      >
                        <X size={14} />
                      </IconButton>
                      <IconButton
                        label={`Delete ${task.title}`}
                        onClick={() => onDeleteTask(task.id)}
                        danger
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <input
                value={taskDraft}
                onChange={(inputEvent) =>
                  onTaskDraftChange(inputEvent.target.value)
                }
                className="h-10 min-w-0 rounded-2xl bg-white/75 px-3 text-sm font-semibold outline-none placeholder:text-[#9b9baa]"
                placeholder="New task for this event"
              />
              <button
                type="button"
                onClick={onCreateTask}
                className="h-10 rounded-2xl bg-[#007aff] px-4 text-sm font-bold text-white transition active:scale-95"
              >
                Add
              </button>
            </div>
            {unboundTasks.length > 0 && (
              <select
                value=""
                onChange={(selectEvent) => {
                  if (selectEvent.target.value) {
                    onLinkTask(selectEvent.target.value);
                  }
                }}
                className="mt-2 h-10 w-full rounded-2xl bg-white/75 px-3 text-sm font-semibold outline-none"
                aria-label={`Link an existing task to ${event.title}`}
              >
                <option value="">Link existing task</option>
                {unboundTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="mt-3 rounded-3xl bg-white/55 p-3 backdrop-blur">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-[#636366]">
                Specific event sharing
              </p>
              <span className="rounded-full bg-[#f2f2f7] px-2 py-0.5 text-[11px] font-bold text-[#8e8e93]">
                Safe placeholder
              </span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                value={shareDraft}
                onChange={(inputEvent) =>
                  onShareDraftChange(inputEvent.target.value)
                }
                className="h-10 min-w-0 rounded-2xl bg-white/75 px-3 text-sm font-semibold outline-none placeholder:text-[#9b9baa]"
                placeholder="person@example.com"
              />
              <button
                type="button"
                onClick={onShare}
                className="grid h-10 place-items-center rounded-2xl bg-[#af52de] px-4 text-sm font-bold text-white transition active:scale-95"
                aria-label={`Prepare share invite for ${event.title}`}
              >
                <Share2 size={15} />
              </button>
            </div>
            {(event.sharedWith ?? []).map((share) => (
              <p
                key={share.id}
                className="mt-2 truncate text-xs font-bold text-[#7c7c8a]"
              >
                {share.email} · {share.role} · {share.status}
              </p>
            ))}
            {(event.activity ?? []).length > 0 && (
              <p className="mt-2 text-xs font-bold text-[#8e8e93]">
                Latest activity: {event.activity?.at(-1)?.text}
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function CalendarStrip({
  calendars,
  onToggle,
}: {
  calendars: AppCalendar[];
  onToggle: (calendarId: string) => void;
}) {
  return (
    <section className="mb-4 rounded-[24px] border border-white/60 bg-white/58 p-3 shadow-lg shadow-black/5 backdrop-blur-2xl">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-bold text-[#8e8e93]">Calendars</p>
        <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold text-[#007aff]">
          {calendars.length}/3 free
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {calendars.map((calendar) => (
          <button
            key={calendar.id}
            type="button"
            onClick={() => onToggle(calendar.id)}
            className={[
              "flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold transition active:scale-95",
              calendar.visible
                ? "border-white/70 bg-white/80 text-[#1d1d1f]"
                : "border-white/50 bg-white/35 text-[#8e8e93]",
            ].join(" ")}
          >
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: calendar.color }}
            />
            {calendar.name}
            {calendar.shared && <Users size={14} />}
          </button>
        ))}
      </div>
    </section>
  );
}

function TasksTab({
  tasks,
  taskView,
  setTaskView,
  title,
  onToggle,
  onDelete,
  onEdit,
}: {
  tasks: TaskListItem[];
  taskView: TaskView;
  setTaskView: (view: TaskView) => void;
  title: string;
  onToggle: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onEdit: (taskId: string, currentTitle: string) => void;
}) {
  return (
    <section>
      <SectionTitle
        eyebrow="Tasks"
        title={`Checklist for ${title}`}
        count={tasks.length}
      />
      <div className="mb-4 grid grid-cols-3 rounded-full bg-white/60 p-1 text-sm font-bold shadow-sm backdrop-blur-xl">
        {taskViewOptions.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setTaskView(option)}
            className={[
              "h-9 rounded-full capitalize transition",
              taskView === option
                ? "bg-[#1d1d1f] text-white shadow-lg shadow-black/15"
                : "text-[#636366]",
            ].join(" ")}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {tasks.length === 0 ? (
          <EmptyState
            title={`No tasks for this ${taskView}.`}
            body="Switch the task range or move the calendar to another date."
          />
        ) : (
          tasks.map((task) => (
            <article
              key={task.id}
              className="flex w-full items-center gap-3 rounded-[24px] border border-white/60 bg-white/70 p-4 text-left shadow-lg shadow-black/5 backdrop-blur-xl"
            >
              <button
                type="button"
                onClick={() => onToggle(task.id)}
                className={[
                  "grid size-8 place-items-center rounded-full",
                  task.done
                    ? "bg-[#34c759] text-white"
                    : "bg-[#f2f2f7] text-transparent",
                ].join(" ")}
                aria-label={`Toggle ${task.title}`}
              >
                <Check size={16} />
              </button>
              <span className="min-w-0 flex-1">
                <span
                  className={[
                    "block truncate text-base font-semibold",
                    task.done ? "line-through text-[#8e8e93]" : "",
                  ].join(" ")}
                >
                  {task.title}
                </span>
                <span className="block truncate text-sm font-semibold text-[#8e8e93]">
                  {task.eventTitle}
                  {task.eventStatus === "cancelled" ? " · event cancelled" : ""}
                </span>
              </span>
                            <div className="flex gap-1">
                <IconButton
                  label={`Edit ${task.title}`}
                  onClick={() => onEdit(task.id, task.title)}
                >
                  <Edit3 size={15} />
                </IconButton>
                <IconButton
                  label={`Delete ${task.title}`}
                  onClick={() => onDelete(task.id)}
                  danger
                >
                  <Trash2 size={15} />
                </IconButton>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function AlertsTab({
  alerts,
  calendarInvitations,
  onCalendarInvitationResponse,
}: {
  alerts: RescheduleReminder[];
  calendarInvitations: CalendarInvitation[];
  onCalendarInvitationResponse: (
    invitationId: string,
    action: "accept" | "decline",
  ) => void;
}) {
  return (
    <section>
      <SectionTitle
        eyebrow="Alerts"
        title="Reminders & shared calendars"
        count={alerts.length + calendarInvitations.length}
      />

      <div className="space-y-3">
        {calendarInvitations.map((invitation) => (
          <article
            key={invitation.id}
            className="rounded-[24px] border border-white/60 bg-white/75 p-4 shadow-lg shadow-black/5 backdrop-blur-xl"
          >
            <div className="flex items-start gap-3">
              <div
                className="mt-1 size-3 rounded-full"
                style={{ backgroundColor: invitation.calendar.color }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-base font-black text-[#1d1d1f]">
                  Shared calendar invite
                </p>
                <p className="mt-1 text-sm font-semibold text-[#636366]">
                  You were invited to{" "}
                  <span className="font-black">{invitation.calendar.name}</span>{" "}
                  as {invitation.role}.
                </p>
                <p className="mt-1 text-xs font-bold text-[#8e8e93]">
                  Free plan allows one shared calendar, and shared calendars count toward the 3 calendar limit.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onCalendarInvitationResponse(invitation.id, "decline")}
                className="h-10 rounded-full bg-[#ffe8e6] px-4 text-sm font-black text-[#ff3b30] transition active:scale-95"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => onCalendarInvitationResponse(invitation.id, "accept")}
                className="h-10 rounded-full bg-[#34c759] px-4 text-sm font-black text-white transition active:scale-95"
              >
                Accept
              </button>
            </div>
          </article>
        ))}

        {alerts.length === 0 && calendarInvitations.length === 0 ? (
          <EmptyState
            title="No reminders"
            body="Cancelled events, task reminders, and shared calendar invites will show here."
          />
        ) : (
          alerts.map((alert) => (
            <ReminderCard key={alert.id} reminder={alert} />
          ))
        )}
      </div>
    </section>
  );
}

function StatsTab({
  stats,
  statsRange,
  setStatsRange,
  statsPeriodLabel,
  isPremium,
  aiSuggestions,
  aiEnabled,
}: {
  stats: ReturnType<typeof computeStats>;
  statsRange: StatsRange;
  setStatsRange: (range: StatsRange) => void;
  statsPeriodLabel: string;
  isPremium: boolean;
  aiSuggestions: string[];
  aiEnabled: boolean;
}) {
  const rangeLabel =
    statsRange === "daily"
      ? "Daily"
      : statsRange === "yearly"
        ? "Yearly"
        : "Monthly";

  function selectRange(range: StatsRange) {
    if (!isPremium && range !== "monthly") return;
    setStatsRange(range);
  }

  return (
    <section className="space-y-3">
      <SectionTitle
        eyebrow={`${rangeLabel} stats`}
        title={statsPeriodLabel}
        count={stats.totalEvents + stats.totalTasks}
      />

      <div className="grid grid-cols-3 gap-2 rounded-full bg-white/60 p-1 text-xs font-black shadow-sm backdrop-blur-xl">
        {(["daily", "monthly", "yearly"] as StatsRange[]).map((range) => {
          const locked = !isPremium && range !== "monthly";
          const selected = statsRange === range;

          return (
            <button
              key={range}
              type="button"
              disabled={locked}
              onClick={() => selectRange(range)}
              className={[
                "h-9 rounded-full capitalize transition active:scale-95",
                selected
                  ? "bg-[#1d1d1f] text-white shadow-lg shadow-black/15"
                  : "text-[#636366]",
                locked ? "cursor-not-allowed opacity-55" : "",
              ].join(" ")}
              title={locked ? "Premium" : `${range} stats`}
            >
              {range}
              {locked ? " 🔒" : ""}
            </button>
          );
        })}
      </div>

      <div className="rounded-[28px] border border-white/60 bg-white/70 p-4 shadow-lg shadow-black/5 backdrop-blur-xl">
        <p className="text-sm font-black uppercase tracking-[0.14em] text-[#8e8e93]">
          Snapshot
        </p>
        <p className="mt-2 text-sm font-semibold leading-6 text-[#636366]">
          <span className="font-black text-[#1d1d1f]">
            {stats.upcomingEvents}
          </span>{" "}
          upcoming event{stats.upcomingEvents === 1 ? "" : "s"} and{" "}
          <span className="font-black text-[#1d1d1f]">{stats.openTasks}</span>{" "}
          open task{stats.openTasks === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label={`${rangeLabel} events`} value={stats.totalEvents} />
        <Stat label="Upcoming events" value={stats.upcomingEvents} />
        <Stat label="Open tasks" value={stats.openTasks} />
        <Stat label="Completed tasks" value={stats.completedTasks} />
      </div>

      <div className="rounded-[28px] border border-white/60 bg-white/70 p-4 shadow-lg shadow-black/5 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#8e8e93]">Task progress</p>
            <p className="mt-1 text-2xl font-black text-[#1d1d1f]">
              {stats.taskCompletionRate}%
            </p>
          </div>

          <p className="rounded-full bg-white/80 px-3 py-1 text-xs font-black text-[#34c759] shadow-sm">
            {stats.completedTasks}/{stats.totalTasks} done
          </p>
        </div>

        <div className="mt-3 h-3 rounded-full bg-[#f2f2f7]">
          <div
            className="h-3 rounded-full bg-[#34c759]"
            style={{ width: `${stats.taskCompletionRate}%` }}
          />
        </div>
      </div>

      <div className="rounded-[28px] border border-white/60 bg-white/70 p-4 shadow-lg shadow-black/5 backdrop-blur-xl">
        <p className="text-sm font-bold text-[#8e8e93]">Patterns</p>

        <p className="mt-2 text-sm font-semibold">
          Most used tag: {stats.mostUsedCategory}
        </p>

        <p className="mt-1 text-sm font-semibold">
          Most active day: {stats.mostActiveDay}
        </p>

        <p className="mt-1 text-sm font-semibold">
          Cancelled events: {stats.cancelledEvents}
        </p>

        <p className="mt-3 text-sm font-semibold text-[#636366]">
          {stats.monthlySummary}
        </p>
      </div>

      <div className="rounded-[28px] border border-white/60 bg-white/70 p-4 shadow-lg shadow-black/5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Brain size={18} className="text-[#af52de]" />
          <p className="text-sm font-bold text-[#8e8e93]">AI Lite</p>
        </div>

        <p className="mt-2 text-sm font-semibold text-[#636366]">
          {aiEnabled
            ? "Rule-based suggestions are generated locally from your visible calendar state."
            : "AI Lite is disabled by default. Enable it in Settings to see local rule-based insights."}
        </p>

        {aiEnabled && (
          <div className="mt-3 space-y-2">
            {aiSuggestions.map((suggestion) => (
              <p
                key={suggestion}
                className="rounded-2xl bg-[#f7eaff] px-3 py-2 text-sm font-semibold text-[#66308a]"
              >
                {suggestion}
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SettingsTab({
  session,
  calendars,
  workspaceLoading,
  workspaceMessage,
  settingsMessage,
  settingsError,
  calendarDraft,
  setCalendarDraft,
  onCreateCalendar,
  onUpdateCalendar,
  onAskDeleteCalendar,
  onUpdateMember,
  onRemoveMember,
  onLeaveCalendar,
  memberDraft,
  setMemberDraft,
  onAddMember,
  settings,
  setSettings,
  savedSettings,
  notificationPermission,
  pushStatus,
  pushConfigured,
  pushSubscribed,
  cronConfigured,
  notificationCapabilities,
  notificationActionMessage,
  isMobileDevice,
  canVibrate,
  activeSection,
  onSectionChange,
  onNotificationChange,
  onRequestNotifications,
  onUnsubscribeNotifications,
  onTestNotification,
  onAiChange,
  onSaveSettings,
  onRevertSettings,
  onOpenDeleteAccount,
}: {
  session: AppSession | null;
  calendars: AppCalendar[];
  workspaceLoading: boolean;
  workspaceMessage: string;
  settingsMessage: string;
  settingsError: string;
  calendarDraft: { name: string; color: string };
  setCalendarDraft: (draft: { name: string; color: string }) => void;
  onCreateCalendar: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateCalendar: (
    calendarId: string,
    updates: { name?: string; color?: string },
  ) => void;
  onAskDeleteCalendar: (calendar: AppCalendar) => void;
  onUpdateMember: (
    calendarId: string,
    memberId: string,
    role: "owner" | "editor" | "viewer",
  ) => void;
  onRemoveMember: (calendarId: string, memberId: string) => void;
  onLeaveCalendar: (calendar: AppCalendar) => void;
  memberDraft: { calendarId: string; email: string; role: "editor" | "viewer" };
  setMemberDraft: (draft: {
    calendarId: string;
    email: string;
    role: "editor" | "viewer";
  }) => void;
  onAddMember: (event: FormEvent<HTMLFormElement>) => void;
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  savedSettings: AppSettings;
  notificationPermission: string;
  pushStatus: string;
  pushConfigured: boolean;
  pushSubscribed: boolean;
  cronConfigured: boolean;
  notificationCapabilities: NotificationCapabilities;
  notificationActionMessage: string;
  isMobileDevice: boolean;
  canVibrate: boolean;
  activeSection: SettingsSectionId;
  onSectionChange: (section: SettingsSectionId) => void;
  onNotificationChange: (
    key: keyof AppSettings["notifications"],
    value: boolean | string,
  ) => void;
  onRequestNotifications: () => void;
  onUnsubscribeNotifications: () => void;
  onTestNotification: () => void;
  onAiChange: (key: keyof AiSettings, value: boolean) => void;
  onSaveSettings: () => void;
  onRevertSettings: () => void;
  onOpenDeleteAccount: () => void;
}) {
  const selectedCalendar = calendars.find(
    (calendar) => calendar.id === memberDraft.calendarId,
  );
  const sharedCalendarUsed = calendars.some(
    (calendar) => calendar.shared && calendar.id !== memberDraft.calendarId,
  );
  const memberInviteDisabled =
    !selectedCalendar || (!selectedCalendar.shared && sharedCalendarUsed);
  const sharedCalendars = calendars.filter((calendar) => calendar.shared);
  const hasUnsavedSettings = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [settings, savedSettings],
  );
  const notificationRows = [
    ["eventReminders", "Event reminders"],
    ["taskReminders", "Task reminders"],
    ["dailyAgenda", "Daily agenda"],
    ["rescheduleReminders", "Reschedule reminders"],
    ["birthdayReminders", "Birthday reminders"],
    ...(!isMobileDevice && notificationCapabilities.supportsNotifications
      ? ([["desktopNotifications", "Desktop notifications"]] as const)
      : []),
    ...(isMobileDevice && notificationCapabilities.supportsPush
      ? ([["mobileNotifications", "Mobile/PWA notifications"]] as const)
      : []),
    ["quietHours", "Quiet hours"],
    ["sound", "Sound"],
    ...(canVibrate && notificationCapabilities.supportsVibration
      ? ([["vibration", "Vibration"]] as const)
      : []),
  ] as const;

  return (
    <section className="space-y-3">
      <SectionTitle
        eyebrow="Settings"
        title="Account workspace"
        count={calendars.length}
      />
      <div className="sticky top-0 z-10 grid grid-cols-2 gap-2 rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-2 shadow-lg shadow-[var(--shadow-soft)] backdrop-blur-xl lg:top-3">
        <button
          type="button"
          onClick={onSaveSettings}
          className="h-11 rounded-full bg-[var(--accent)] text-sm font-bold text-white shadow-lg shadow-[var(--shadow-soft)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!hasUnsavedSettings && !settingsError}
        >
          Save changes
        </button>
        <button
          type="button"
          onClick={onRevertSettings}
          className="h-11 rounded-full border border-[var(--border-soft)] bg-[var(--surface-strong)] text-sm font-bold text-[var(--muted)] shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!hasUnsavedSettings}
        >
          Revert
        </button>
      </div>
      {workspaceLoading && (
        <p className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm font-bold text-[var(--accent)] shadow-sm shadow-[var(--shadow-soft)]">
          Loading account data...
        </p>
      )}
      <SettingsCard
        id="settings-profile"
        sectionId="profile"
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        title="Profile"
        icon={<Users size={18} />}
      >
        <p className="text-sm font-semibold text-[#636366]">
          Signed in as {session?.user.email}
        </p>
        <label className="mt-3 block text-xs font-black uppercase tracking-[0.12em] text-[#8e8e93]">
          General account name
        </label>
        <input
          value={settings.profile.accountName}
          onChange={(event) =>
            setSettings({
              ...settings,
              profile: { ...settings.profile, accountName: event.target.value },
            })
          }
          className="input-shell mt-2 w-full"
          placeholder="Your account name"
        />
        <p className="mt-2 text-xs font-bold text-[#8e8e93]">
          This is your default name. You can use different display names inside
          shared calendars.
        </p>
        <label className="mt-4 flex items-start gap-3 rounded-3xl bg-[#f8f7ff] p-4 shadow-sm shadow-black/5">
          <input
            type="checkbox"
            checked={settings.skipIntro}
            onChange={(event) =>
              setSettings({ ...settings, skipIntro: event.target.checked })
            }
            className="mt-1 size-5 accent-[#007aff]"
          />
          <span>
            <span className="block text-sm font-black text-[#18181b]">
              Skip the welcome intro
            </span>
            <span className="mt-1 block text-xs font-bold leading-5 text-[#8e8e93]">
              When this is on, Arcgenda opens straight to your calendar instead
              of showing the tiny hello screen after login.
            </span>
          </span>
        </label>
        {sharedCalendars.length > 0 && (
          <div className="mt-3 space-y-2">
            {sharedCalendars.map((calendar) => (
              <label key={calendar.id} className="block">
                <span className="text-xs font-black text-[#8e8e93]">
                  {calendar.name} display name
                </span>
                <input
                  value={
                    settings.profile.calendarDisplayNames[calendar.id] ?? ""
                  }
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      profile: {
                        ...settings.profile,
                        calendarDisplayNames: {
                          ...settings.profile.calendarDisplayNames,
                          [calendar.id]: event.target.value,
                        },
                      },
                    })
                  }
                  className="input-shell mt-1 w-full"
                  placeholder={
                    settings.profile.accountName ||
                    "Display name for this calendar"
                  }
                />
              </label>
            ))}
          </div>
        )}
      </SettingsCard>

      <SettingsCard
        id="settings-theme"
        sectionId="theme"
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        title="Theme"
        icon={<Palette size={18} />}
      >
        <select
          value={settings.theme}
          onChange={(event) => {
            const nextTheme = event.target.value as AppSettings["theme"];
            setSettings({ ...settings, theme: nextTheme });
            applyDocumentTheme(nextTheme, true);
          }}
          className="input-shell mt-3 w-full"
        >
          <option value="system">System theme</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        <p className="mt-2 text-xs font-bold text-[#8e8e93]">
          Theme is part of the profile save flow. Use Save Settings when you are
          happy with it.
        </p>
      </SettingsCard>

      <SettingsCard
        id="settings-calendars"
        sectionId="calendars"
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        title="Calendar Settings"
        icon={<CalendarDays size={18} />}
      >
        <form
          onSubmit={onCreateCalendar}
          className="grid grid-cols-[1fr_auto] gap-2"
        >
          <input
            value={calendarDraft.name}
            onChange={(event) =>
              setCalendarDraft({ ...calendarDraft, name: event.target.value })
            }
            className="input-shell"
            placeholder="New calendar name"
            disabled={calendars.length >= 3}
          />
          <button
            className="rounded-2xl bg-[#007aff] px-4 text-sm font-bold text-white disabled:opacity-50"
            disabled={calendars.length >= 3}
          >
            Add
          </button>
        </form>
        <p className="mt-2 text-xs font-bold text-[#8e8e93]">
          Free plan: up to 3 calendars total. Shared calendars also count toward
          your free calendar limit.
        </p>
        <div className="mt-4 space-y-3">
          {calendars.map((calendar) => (
            <CalendarManagementRow
              key={`${calendar.id}-${calendar.name}-${calendar.color}`}
              calendar={calendar}
              onUpdate={onUpdateCalendar}
              onAskDelete={onAskDeleteCalendar}
              displayName={
                settings.profile.calendarDisplayNames[calendar.id] ?? ""
              }
              onUpdateMember={onUpdateMember}
              onRemoveMember={onRemoveMember}
              onLeaveCalendar={onLeaveCalendar}
              onChangeDisplayName={(value) =>
                setSettings({
                  ...settings,
                  profile: {
                    ...settings.profile,
                    calendarDisplayNames: {
                      ...settings.profile.calendarDisplayNames,
                      [calendar.id]: value,
                    },
                  },
                })
              }
            />
          ))}
        </div>
        <form onSubmit={onAddMember} className="mt-3 space-y-2">
          <select
            value={memberDraft.calendarId}
            onChange={(event) =>
              setMemberDraft({ ...memberDraft, calendarId: event.target.value })
            }
            className="input-shell w-full"
          >
            {calendars.map((calendar) => (
              <option key={calendar.id} value={calendar.id}>
                {calendar.name}
              </option>
            ))}
          </select>
          <input
            value={memberDraft.email}
            onChange={(event) =>
              setMemberDraft({ ...memberDraft, email: event.target.value })
            }
            className="input-shell w-full"
            placeholder="member@example.com"
            disabled={memberInviteDisabled}
          />
          <select
            value={memberDraft.role}
            onChange={(event) =>
              setMemberDraft({
                ...memberDraft,
                role: event.target.value as "editor" | "viewer",
              })
            }
            className="input-shell w-full"
            disabled={memberInviteDisabled}
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button
            disabled={memberInviteDisabled}
            className="h-11 w-full rounded-full bg-[#1d1d1f] text-sm font-bold text-white disabled:opacity-50"
          >
            Add invite placeholder
          </button>
          {memberInviteDisabled && (
            <p className="text-xs font-bold text-[#ff9500]">
              Free plan includes one shared calendar. Remove sharing from
              another calendar before inviting here.
            </p>
          )}
        </form>
      </SettingsCard>

      <SettingsCard
        id="settings-notifications"
        sectionId="notifications"
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        title="Notification Settings"
        icon={<BellRing size={18} />}
      >
        <div className="rounded-2xl bg-[#f2f2f7] p-3">
          <p className="text-sm font-bold text-[#1d1d1f]">
            Permission on this{" "}
            {isMobileDevice ? "mobile/PWA device" : "desktop browser"}:{" "}
            {notificationPermission}
          </p>
          <p className="mt-1 text-xs font-bold leading-5 text-[#8e8e93]">
            {!notificationCapabilities.supportsNotifications
              ? "Notifications are not supported in this browser."
              : !notificationCapabilities.supportsServiceWorker
                ? "Service workers are not supported, so closed-app reminders cannot run here."
                : !notificationCapabilities.supportsPush
                  ? notificationCapabilities.isIOS &&
                    !notificationCapabilities.isPWAInstalled
                    ? "Install Arcgenda to Home Screen to enable iPhone push notifications."
                    : "Web Push is not supported in this browser."
                  : notificationPermission === "granted"
                    ? pushStatus
                    : isMobileDevice
                      ? "Tap Enable notifications. On iPhone, Web Push requires the PWA to be installed to the Home Screen and notifications allowed."
                      : "Click Enable push. If no popup appears, use the lock icon in the address bar and allow notifications."}
          </p>
          <p className="mt-2 text-xs font-bold leading-5 text-[#8e8e93]">
            Closed-app reminders require Web Push, VAPID keys, a saved device
            subscription, and a cron scheduler.
          </p>
          {!pushConfigured && (
            <p className="mt-2 text-xs font-black text-[#ff9500]">
              Closed-app push notifications are not configured yet.
            </p>
          )}
          {pushConfigured && !cronConfigured && (
            <p className="mt-2 text-xs font-black text-[#ff9500]">
              Background reminder delivery is not fully configured yet.
            </p>
          )}
          {notificationActionMessage && (
            <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-[#636366]">
              {notificationActionMessage}
            </p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onRequestNotifications}
              className="h-10 rounded-full bg-[#007aff] px-4 text-sm font-bold text-white"
              disabled={!notificationCapabilities.supportsPush}
            >
              {pushSubscribed ? "Refresh push" : "Enable push"}
            </button>
            <button
              type="button"
              onClick={onTestNotification}
              className="h-10 rounded-full bg-white/75 px-4 text-sm font-bold text-[#007aff]"
              disabled={!notificationCapabilities.supportsNotifications}
            >
              Test notification
            </button>
          </div>
          {pushSubscribed && (
            <button
              type="button"
              onClick={onUnsubscribeNotifications}
              className="mt-2 h-10 w-full rounded-full bg-[#ffe8e6] px-4 text-sm font-bold text-[#ff3b30]"
            >
              Disable on this device
            </button>
          )}
        </div>
        <div className="mt-3 grid gap-2">
          {notificationRows.map(([key, label]) => (
            <Toggle
              key={key}
              checked={Boolean(settings.notifications[key])}
              label={label}
              onClick={() =>
                onNotificationChange(key, !settings.notifications[key])
              }
            />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <input
            type="time"
            value={settings.notifications.quietStart}
            onChange={(event) =>
              onNotificationChange("quietStart", event.target.value)
            }
            className="input-shell w-full"
            aria-label="Quiet hours start"
          />
          <input
            type="time"
            value={settings.notifications.quietEnd}
            onChange={(event) =>
              onNotificationChange("quietEnd", event.target.value)
            }
            className="input-shell w-full"
            aria-label="Quiet hours end"
          />
        </div>
        <select
          value={settings.notifications.defaultTiming}
          onChange={(event) =>
            onNotificationChange("defaultTiming", event.target.value)
          }
          className="input-shell mt-2 w-full"
        >
          <option value="At time of event">At time of event</option>
          <option value="5 minutes before">5 minutes before</option>
          <option value="10 minutes before">10 minutes before</option>
          <option value="15 minutes before">15 minutes before</option>
          <option value="30 minutes before">30 minutes before</option>
          <option value="1 hour before">1 hour before</option>
          <option value="1 day before">1 day before</option>
        </select>
        <p className="mt-3 text-xs font-bold text-[#8e8e93]">
          Default timing decides how early event reminders alert you, for
          example 15 minutes before a meeting. Quiet hours pause reminders
          between the start and end times so Arcgenda does not interrupt sleep
          or focus time. Device-only options appear only when this device
          supports them.
        </p>
      </SettingsCard>

      <SettingsCard
        id="settings-ai"
        sectionId="ai"
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        title="AI Lite and privacy"
        icon={<Shield size={18} />}
      >
        {(
          [
            ["enabled", "Enable AI Lite"],
            ["scheduling", "Smart scheduling suggestions"],
            ["insights", "Productivity insights"],
            ["reschedule", "Smart reschedule suggestions"],
            ["weeklySummary", "Weekly summary text"],
            ["privateMode", "Private mode"],
          ] as const
        ).map(([key, label]) => (
          <Toggle
            key={key}
            checked={settings.ai[key]}
            label={label}
            onClick={() => onAiChange(key, !settings.ai[key])}
          />
        ))}
        <p className="mt-3 text-xs font-bold text-[#8e8e93]">
          AI Lite is local and rule-based for now. Future OpenAI/Claude
          integrations would be opt-in. Your data is not sold.
        </p>
      </SettingsCard>

      <SettingsCard
        id="settings-sync"
        sectionId="sync"
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        title="Sync & Export"
        icon={<Smartphone size={18} />}
      >
        <div className="grid gap-2">
          <PlaceholderRow title="Google Calendar sync" />
          <PlaceholderRow title="Outlook Calendar sync" />
          <PlaceholderRow title="Device calendar sync" />
          <PlaceholderRow title="Export data" />
        </div>
      </SettingsCard>

      <SettingsCard
        id="settings-danger"
        sectionId="danger"
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        title="Danger Zone"
        icon={<Trash2 size={18} />}
      >
        <p className="text-sm font-semibold leading-6 text-[#636366]">
          Destructive actions are separated from profile settings so they are
          harder to hit by accident.
        </p>
        <button
          onClick={onOpenDeleteAccount}
          className="mt-3 h-11 w-full rounded-full bg-[#ff3b30] text-sm font-bold text-white shadow-lg shadow-[#ff3b30]/20"
        >
          Delete account
        </button>
      </SettingsCard>
    </section>
  );
}

function memberStatusClasses(status: AppCalendar["members"][number]["status"]) {
  if (status === "accepted") {
    return "bg-[#e8f8ee] text-[#1f8f45] ring-[#34c759]/20";
  }

  if (status === "declined") {
    return "bg-[#ffe8e6] text-[#c82d21] ring-[#ff3b30]/20";
  }

  return "bg-[#f2f2f7] text-[#6b7280] ring-[#8e8e93]/20";
}

function memberStatusLabel(status: AppCalendar["members"][number]["status"]) {
  if (status === "accepted") return "Accepted";
  if (status === "declined") return "Declined";
  return "Pending";
}

function CalendarManagementRow({
  calendar,
  onUpdate,
  onAskDelete,
  displayName,
  onChangeDisplayName,
  onUpdateMember,
  onRemoveMember,
  onLeaveCalendar,
}: {
  calendar: AppCalendar;
  onUpdate: (
    calendarId: string,
    updates: { name?: string; color?: string },
  ) => void;
  onAskDelete: (calendar: AppCalendar) => void;
  displayName: string;
  onChangeDisplayName: (value: string) => void;
  onUpdateMember: (
    calendarId: string,
    memberId: string,
    role: "owner" | "editor" | "viewer",
  ) => void;
  onRemoveMember: (calendarId: string, memberId: string) => void;
  onLeaveCalendar: (calendar: AppCalendar) => void;
}) {
  const [name, setName] = useState(calendar.name);
  const [color, setColor] = useState(calendar.color);

  const canDelete = calendar.role === "owner";
  const canEdit = calendar.role === "owner";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setName(calendar.name);
      setColor(calendar.color);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [calendar.color, calendar.name]);

  return (
    <article className="rounded-[24px] bg-white/70 p-3 shadow-lg shadow-black/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="size-3 rounded-full"
              style={{ backgroundColor: calendar.color }}
            />
            <p className="truncate text-sm font-black">{calendar.name}</p>
          </div>
          <p className="mt-1 text-xs font-bold text-[#8e8e93]">
            {calendar.shared ? "Shared calendar" : "Private calendar"} · Role:{" "}
            {calendar.role}
          </p>
        </div>
        {calendar.shared && (
          <span className="rounded-full bg-[#f7eaff] px-3 py-1 text-xs font-black text-[#8b35bd]">
            Shared
          </span>
        )}
      </div>

      {canEdit ? (
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="input-shell h-11 w-full"
            placeholder="Calendar name"
          />
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="h-11 w-12 rounded-2xl border-0 bg-white"
            aria-label={`${calendar.name} color`}
          />
          <button
            type="button"
            onClick={() => onUpdate(calendar.id, { name, color })}
            className="h-10 rounded-full bg-[#007aff] px-4 text-sm font-bold text-white"
          >
            Save calendar
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={() => onAskDelete(calendar)}
              className="h-10 rounded-full bg-[#ffe8e6] px-4 text-sm font-bold text-[#ff3b30]"
            >
              Delete
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3 rounded-2xl bg-[#f2f2f7] px-3 py-2 text-xs font-bold text-[#8e8e93]">
          You can view this shared calendar.
          {calendar.shared && (
            <button
              type="button"
              onClick={() => onLeaveCalendar(calendar)}
              className="mt-2 block h-9 rounded-full bg-white px-4 text-xs font-black text-[#ff3b30]"
            >
              Leave shared calendar
            </button>
          )}
        </div>
      )}

      {calendar.shared && (
        <label className="mt-3 block">
          <span className="text-xs font-black text-[#8e8e93]">
            My display name in this calendar
          </span>
          <input
            value={displayName}
            onChange={(event) => onChangeDisplayName(event.target.value)}
            className="input-shell mt-1 h-11 w-full"
            placeholder="Display name for this calendar"
          />
        </label>
      )}

      {calendar.members.length > 0 && (
        <div className="mt-3 space-y-2">
          {calendar.members.map((member) => (
            <div
              key={member.id}
              className="grid gap-2 rounded-2xl bg-[#f2f2f7] p-2 text-xs font-bold text-[#8e8e93] sm:grid-cols-[1fr_auto_auto] sm:items-center"
            >
              <span className="min-w-0 truncate">
  {member.displayName || member.email} · {member.status}
</span>
              {canEdit && member.role !== "owner" ? (
                <>
                  <select
                    value={member.role}
                    onChange={(event) =>
                      onUpdateMember(
                        calendar.id,
                        member.id,
                        event.target.value as "owner" | "editor" | "viewer",
                      )
                    }
                    className="h-9 rounded-xl bg-white px-2 text-xs font-bold"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    {member.userId && <option value="owner">Make owner</option>}
                  </select>
                  <button
                    type="button"
                    onClick={() => onRemoveMember(calendar.id, member.id)}
                    className="h-9 rounded-xl bg-[#ffe8e6] px-3 text-xs font-black text-[#ff3b30]"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <span className="rounded-full bg-white/75 px-3 py-2 text-center text-xs font-black capitalize">
                  {member.role}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function EventComposer({
  draft,
  editing,
  kind,
  setKind,
  tags,
  calendars,
  events,
  unboundTasks,
  selectedTaskIds,
  setSelectedTaskIds,
  taskDraft,
  setTaskDraft,
  reminderDraft,
  setReminderDraft,
  onChange,
  onClose,
  onSubmit,
  onSubmitTask,
  onAddTag,
  submitting,
}: {
  draft: EventDraft;
  editing: boolean;
  kind: ComposerKind;
  setKind: (kind: ComposerKind) => void;
  tags: CategoryStyle[];
  calendars: AppCalendar[];
  events: CalendarEvent[];
  unboundTasks: StandaloneTask[];
  selectedTaskIds: string[];
  setSelectedTaskIds: (ids: string[]) => void;
  taskDraft: TaskDraft;
  setTaskDraft: (draft: TaskDraft) => void;
  reminderDraft: ReminderDraft;
  setReminderDraft: (draft: ReminderDraft) => void;
  onChange: (draft: EventDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitTask: (event: FormEvent<HTMLFormElement>) => void;
  onAddTag: () => void;
  submitting: boolean;
}) {
  const writableCalendars = calendars.filter(
    (calendar) => calendar.role !== "viewer",
  );
  const eventStartDate = dateTimeFromDraft(
    draft.date,
    draft.time,
    draft.allDay,
  );
  const presetReminderPreview =
    reminderDraft.enabled && reminderDraft.preset !== "custom"
      ? reminderDateTimeFromPreset(eventStartDate, reminderDraft.preset)
      : null;
  const customReminderDisabled = draft.recurrence !== "none";

  return (
    <ModalShell>
      <form
        onSubmit={kind === "event" ? onSubmit : onSubmitTask}
        className="max-h-[calc(100dvh-24px)] w-full max-w-md overflow-y-auto rounded-[32px] border border-white/70 bg-white/88 p-4 shadow-2xl shadow-black/20 backdrop-blur-2xl"
      >
        <ModalHeader
          title={editing ? "Edit event" : "Create"}
          onClose={onClose}
        />
        {!editing && (
          <div className="mb-4 grid grid-cols-2 rounded-full bg-[#f2f2f7] p-1 text-sm font-bold">
            {(["event", "task"] as ComposerKind[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setKind(item)}
                className={[
                  "h-9 rounded-full capitalize transition",
                  kind === item
                    ? "bg-white text-[#007aff] shadow-sm"
                    : "text-[#7c7c8a]",
                ].join(" ")}
              >
                {item}
              </button>
            ))}
          </div>
        )}
        {kind === "task" && !editing ? (
          <div className="space-y-3">
            <FieldLabel label="Task name" helper="What do you need to do?">
              <input
                value={taskDraft.title}
                onChange={(event) =>
                  setTaskDraft({ ...taskDraft, title: event.target.value })
                }
                className="input-shell w-full text-base"
                placeholder="Example: Prepare notes"
                required
              />
            </FieldLabel>
            <label className="flex items-center justify-between gap-3 rounded-3xl border border-white/70 bg-white/70 p-4 shadow-sm shadow-black/5">
              <span>
                <span className="block text-sm font-black text-[#1d1d1f]">
                  Add reminder
                </span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-[#7c7c8a]">
                  Turn this on only when the task needs a due date and time.
                </span>
              </span>

              <input
                type="checkbox"
                checked={taskDraft.reminderEnabled}
                onChange={(event) =>
                  setTaskDraft({
                    ...taskDraft,
                    reminderEnabled: event.target.checked,
                  })
                }
                className="size-5 accent-[#007aff]"
              />
            </label>

            {taskDraft.reminderEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <FieldLabel label="Due date">
                  <input
                    type="date"
                    value={taskDraft.reminderDate}
                    onChange={(event) =>
                      setTaskDraft({
                        ...taskDraft,
                        reminderDate: event.target.value,
                      })
                    }
                    className="input-shell w-full"
                  />
                </FieldLabel>

                <FieldLabel label="Due time">
                  <AppleTimePicker
                    value={taskDraft.reminderTime}
                    onChange={(time) =>
                      setTaskDraft({ ...taskDraft, reminderTime: time })
                    }
                  />
                </FieldLabel>
              </div>
            )}
            <FieldLabel
              label="Link to event"
              helper="Optional. Leave this as no event for a standalone task."
            >
              <select
                value={taskDraft.eventId}
                onChange={(event) =>
                  setTaskDraft({ ...taskDraft, eventId: event.target.value })
                }
                className="input-shell w-full"
              >
                <option value="none">No event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    Bind to: {event.title}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <button
              type="submit"
              disabled={submitting}
              className="mt-4 h-12 w-full rounded-full bg-[#007aff] text-base font-bold text-white shadow-lg shadow-[#007aff]/25 transition active:scale-95 disabled:opacity-55"
            >
              {submitting ? "Creating..." : "Create task"}
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <FieldLabel
                label="Event name"
                helper="The title shown on your calendar."
              >
                <input
                  value={draft.title}
                  onChange={(event) =>
                    onChange({ ...draft, title: event.target.value })
                  }
                  className="input-shell w-full text-base"
                  placeholder="Example: Study focus"
                  required
                />
              </FieldLabel>
              <div className="grid grid-cols-2 gap-3">
                <FieldLabel label="Date">
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(event) =>
                      onChange({ ...draft, date: event.target.value })
                    }
                    className="input-shell w-full"
                  />
                </FieldLabel>
                <FieldLabel label="Time">
                  <AppleTimePicker
                    value={draft.time}
                    disabled={draft.allDay}
                    onChange={(time) => onChange({ ...draft, time })}
                  />
                </FieldLabel>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <FieldLabel label="Tag">
                  <select
                    value={draft.category}
                    onChange={(event) =>
                      onChange({ ...draft, category: event.target.value })
                    }
                    className="input-shell w-full"
                  >
                    {tags.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.label}
                      </option>
                    ))}
                  </select>
                </FieldLabel>
                <button
                  type="button"
                  className="mt-6 grid size-12 place-items-center rounded-2xl bg-[#f2f2f7] text-[#007aff]"
                  onClick={onAddTag}
                  aria-label="Add tag"
                >
                  <Palette size={19} />
                </button>
              </div>
              <FieldLabel
                label={editing ? "Move to calendar" : "Calendar"}
                helper="Choose the calendar space this event belongs to."
              >
                <select
                  value={draft.calendarId ?? ""}
                  onChange={(event) =>
                    onChange({ ...draft, calendarId: event.target.value })
                  }
                  className="input-shell w-full capitalize"
                >
                  {writableCalendars.length === 0 && (
                    <option value="">No calendar</option>
                  )}
                  {writableCalendars.map((calendar) => (
                    <option key={calendar.id} value={calendar.id}>
                      {calendar.name}
                      {calendar.shared ? " (shared)" : ""}
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <p className="text-xs font-bold text-[#8e8e93]">
                Move to calendar: viewers cannot move shared events. Linked
                tasks and reminders stay attached.
              </p>
              <FieldLabel label="Repeat">
                <select
                  value={draft.recurrence}
                  onChange={(event) => {
                    const recurrence = event.target.value as Recurrence;
                    onChange({ ...draft, recurrence });
                    if (
                      recurrence !== "none" &&
                      reminderDraft.preset === "custom"
                    ) {
                      setReminderDraft({ ...reminderDraft, preset: "10m" });
                    }
                  }}
                  className="input-shell w-full capitalize"
                >
                  {recurrences.map((recurrence) => (
                    <option key={recurrence} value={recurrence}>
                      {recurrence}
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel
                label="Location"
                helper="Optional place, room, or link label."
              >
                <input
                  value={draft.location}
                  onChange={(event) =>
                    onChange({ ...draft, location: event.target.value })
                  }
                  className="input-shell w-full"
                  placeholder="Example: Library, Zoom, Home"
                />
              </FieldLabel>
              <FieldLabel
                label="Notes"
                helper="Optional details for future you."
              >
                <textarea
                  value={draft.notes}
                  onChange={(event) =>
                    onChange({ ...draft, notes: event.target.value })
                  }
                  className="min-h-20 w-full resize-none rounded-2xl bg-[#f2f2f7] px-4 py-3 text-sm font-semibold outline-none"
                  placeholder="Add notes, links, or context"
                />
              </FieldLabel>
              <div className="grid grid-cols-2 gap-3">
                <Toggle
                  checked={draft.allDay}
                  label="All day"
                  onClick={() => onChange({ ...draft, allDay: !draft.allDay })}
                />
                <Toggle
                  checked={draft.pinned}
                  label="Pinned"
                  onClick={() => onChange({ ...draft, pinned: !draft.pinned })}
                />
              </div>
              <div className="rounded-2xl bg-[#f2f2f7] p-3">
                <Toggle
                  checked={reminderDraft.enabled}
                  label="Reminder"
                  onClick={() =>
                    setReminderDraft({
                      ...reminderDraft,
                      enabled: !reminderDraft.enabled,
                      preset:
                        !reminderDraft.enabled &&
                        customReminderDisabled &&
                        reminderDraft.preset === "custom"
                          ? "10m"
                          : reminderDraft.preset,
                    })
                  }
                />
                {reminderDraft.enabled && (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {reminderPresets.map((preset) => {
                        const disabled =
                          preset.value === "custom" && customReminderDisabled;
                        return (
                          <button
                            key={preset.value}
                            type="button"
                            disabled={disabled}
                            onClick={() =>
                              setReminderDraft({
                                ...reminderDraft,
                                preset: preset.value,
                              })
                            }
                            className={[
                              "h-10 rounded-2xl px-2 text-xs font-black transition",
                              reminderDraft.preset === preset.value
                                ? "bg-[#007aff] text-white shadow-lg shadow-[#007aff]/20"
                                : "bg-white/75 text-[#636366]",
                              disabled
                                ? "cursor-not-allowed opacity-45"
                                : "active:scale-95",
                            ].join(" ")}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                    {customReminderDisabled && (
                      <p className="text-xs font-bold text-[#8e8e93]">
                        Custom reminder times are available for one-time events.
                      </p>
                    )}
                    {reminderDraft.preset === "custom" &&
                    !customReminderDisabled ? (
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="date"
                          value={reminderDraft.date}
                          onChange={(event) =>
                            setReminderDraft({
                              ...reminderDraft,
                              date: event.target.value,
                            })
                          }
                          className="input-shell bg-white/70"
                        />
                        <AppleTimePicker
                          value={reminderDraft.time}
                          onChange={(time) =>
                            setReminderDraft({ ...reminderDraft, time })
                          }
                        />
                      </div>
                    ) : (
                      presetReminderPreview && (
                        <p className="rounded-2xl bg-white/70 px-3 py-2 text-xs font-bold text-[#636366]">
                          Reminder alerts on{" "}
                          {formatLongDate(
                            fromDateKey(presetReminderPreview.date),
                          )}{" "}
                          at {presetReminderPreview.time}.
                        </p>
                      )
                    )}
                  </div>
                )}
              </div>
              {unboundTasks.length > 0 && (
                <div className="rounded-2xl bg-[#f2f2f7] p-3">
                  <p className="mb-2 text-sm font-bold text-[#7c7c8a]">
                    Bind undone tasks
                  </p>
                  <div className="space-y-2">
                    {unboundTasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() =>
                          setSelectedTaskIds(
                            selectedTaskIds.includes(task.id)
                              ? selectedTaskIds.filter((id) => id !== task.id)
                              : [...selectedTaskIds, task.id],
                          )
                        }
                        className="flex w-full items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-left text-sm font-semibold"
                      >
                        {task.title}
                        <span
                          className={[
                            "grid size-5 place-items-center rounded-full",
                            selectedTaskIds.includes(task.id)
                              ? "bg-[#34c759] text-white"
                              : "bg-[#d1d1d6] text-transparent",
                          ].join(" ")}
                        >
                          <Check size={12} />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              disabled={submitting}
              className="mt-4 h-12 w-full rounded-full bg-[#007aff] text-base font-bold text-white shadow-lg shadow-[#007aff]/25 transition active:scale-95 disabled:opacity-55"
            >
              {submitting
                ? editing
                  ? "Saving..."
                  : "Creating..."
                : editing
                  ? "Save changes"
                  : "Create event"}
            </button>
          </>
        )}
      </form>
    </ModalShell>
  );
}

function TagModal({
  draft,
  setDraft,
  onClose,
  onSubmit,
}: {
  draft: TagDraft;
  setDraft: (draft: TagDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <ModalShell>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-[32px] border border-white/70 bg-white/90 p-4 shadow-2xl shadow-black/20 backdrop-blur-2xl"
      >
        <ModalHeader title="Custom tag" onClose={onClose} />
        <div className="space-y-3">
          <input
            value={draft.label}
            onChange={(event) =>
              setDraft({ ...draft, label: event.target.value })
            }
            className="input-shell"
            placeholder="Tag name"
            required
          />
          <input
            value={draft.icon}
            onChange={(event) =>
              setDraft({ ...draft, icon: event.target.value })
            }
            className="input-shell"
            placeholder="Icon name"
          />
          <div className="grid grid-cols-6 gap-2">
            {colorGrid.map((color) => (
              <button
                key={color}
                type="button"
                className="size-10 rounded-full ring-2 ring-white transition active:scale-95"
                style={{
                  background: color,
                  outline: draft.color === color ? "3px solid #1d1d1f" : "none",
                }}
                onClick={() => setDraft({ ...draft, color })}
                aria-label={`Choose ${color}`}
              />
            ))}
          </div>
        </div>
        <button className="mt-4 h-12 w-full rounded-full bg-[#1d1d1f] text-base font-bold text-white">
          Add tag
        </button>
      </form>
    </ModalShell>
  );
}

function AppleTimePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [hour = "00", minute = "00"] = value.split(":");
  const hours = Array.from({ length: 24 }, (_, index) =>
    String(index).padStart(2, "0"),
  );
  const minutes = Array.from({ length: 60 }, (_, index) =>
    String(index).padStart(2, "0"),
  );

  return (
    <div
      className={[
        "grid h-12 grid-cols-[1fr_auto_1fr] items-center rounded-2xl bg-[#f2f2f7] px-2 text-sm font-semibold",
        disabled ? "opacity-45" : "",
      ].join(" ")}
    >
      <select
        value={hour}
        disabled={disabled}
        onChange={(event) => onChange(`${event.target.value}:${minute}`)}
        className="h-10 appearance-none rounded-xl bg-white/70 text-center outline-none"
        aria-label="Hour"
      >
        {hours.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <span className="px-1 text-[#8e8e93]">:</span>
      <select
        value={minute}
        disabled={disabled}
        onChange={(event) => onChange(`${hour}:${event.target.value}`)}
        className="h-10 appearance-none rounded-xl bg-white/70 text-center outline-none"
        aria-label="Minute"
      >
        {minutes.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}

function FieldLabel({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-[#8e8e93]">
        {label}
      </span>
      {children}
      {helper && (
        <span className="mt-1 block text-xs font-bold text-[#8e8e93]">
          {helper}
        </span>
      )}
    </label>
  );
}

function CancelEventModal({
  event,
  reason,
  scope,
  onReasonChange,
  onScopeChange,
  onClose,
  onConfirm,
}: {
  event: CalendarEvent;
  reason: string;
  scope: CancelScope;
  onReasonChange: (reason: string) => void;
  onScopeChange: (scope: CancelScope) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const repeating = event.recurrence !== "none";
  const confirmLabel =
    repeating && scope === "series-delete" ? "Delete series" : "Cancel event";

  return (
    <ModalShell>
      <div className="w-full max-w-md rounded-[32px] border border-white/70 bg-white/90 p-4 shadow-2xl shadow-black/20 backdrop-blur-2xl">
        <ModalHeader
          title={event.title}
          eyebrow="Cancel event"
          onClose={onClose}
        />
        <p className="text-sm font-semibold leading-6 text-[#636366]">
          This keeps the event in your calendar as cancelled, including the
          reason and cancellation time.
        </p>
        {repeating && (
          <div className="mt-4 space-y-2">
            <button
              type="button"
              className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-bold ${
                scope === "series-cancel"
                  ? "border-[#007aff] bg-[#eaf4ff] text-[#0057b8]"
                  : "border-[#e5e5ea] bg-[#f8f8fb] text-[#3a3a3c]"
              }`}
              onClick={() => onScopeChange("series-cancel")}
            >
              Cancel this repeating event
              <span className="mt-1 block text-xs font-semibold text-[#636366]">
                Keep the series in the calendar and mark it as cancelled.
              </span>
            </button>
            <button
              type="button"
              className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-bold ${
                scope === "series-delete"
                  ? "border-[#ff3b30] bg-[#fff0ef] text-[#b42318]"
                  : "border-[#e5e5ea] bg-[#f8f8fb] text-[#3a3a3c]"
              }`}
              onClick={() => onScopeChange("series-delete")}
            >
              Delete the repeating event
              <span className="mt-1 block text-xs font-semibold text-[#636366]">
                Remove the whole series from active calendar views.
              </span>
            </button>
          </div>
        )}
        <textarea
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          className="mt-4 min-h-28 w-full resize-none rounded-2xl bg-[#f2f2f7] px-4 py-3 text-sm font-semibold outline-none"
          placeholder="Optional cancellation reason"
        />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            className="h-12 rounded-full bg-[#f2f2f7] text-base font-bold"
            onClick={onClose}
          >
            Keep event
          </button>
          <button
            type="button"
            className="h-12 rounded-full bg-[#ff3b30] text-base font-bold text-white shadow-lg shadow-[#ff3b30]/25"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function RescheduleReminderModal({
  event,
  draft,
  onChange,
  onClose,
  onCreate,
}: {
  event: CalendarEvent;
  draft: { date: string; time: string };
  onChange: (draft: { date: string; time: string }) => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  return (
    <ModalShell>
      <div className="w-full max-w-md rounded-[32px] border border-white/70 bg-white/90 p-4 shadow-2xl shadow-black/20 backdrop-blur-2xl">
        <ModalHeader
          title="Create follow-up task?"
          eyebrow="Reschedule reminder"
          onClose={onClose}
        />
        <p className="rounded-2xl bg-[#fff7df] px-4 py-3 text-sm font-semibold text-[#7a5200]">
          Do you want to create a reminder to reschedule this event?
          <span className="mt-1 block text-[#1d1d1f]">
            Reschedule: {event.title}
          </span>
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <input
            type="date"
            value={draft.date}
            onChange={(event) =>
              onChange({ ...draft, date: event.target.value })
            }
            className="input-shell"
          />
          <input
            type="time"
            value={draft.time}
            onChange={(event) =>
              onChange({ ...draft, time: event.target.value })
            }
            className="input-shell"
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            className="h-12 rounded-full bg-[#f2f2f7] text-base font-bold"
            onClick={onClose}
          >
            Not now
          </button>
          <button
            type="button"
            className="h-12 rounded-full bg-[#007aff] text-base font-bold text-white shadow-lg shadow-[#007aff]/25"
            onClick={onCreate}
          >
            Create reminder
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function IntroModal({
  accountName,
  selectedDate,
  todayEvents,
  todayTasks,
  alerts,
  saving,
  onClose,
  onSkipNextTime,
}: {
  accountName: string;
  selectedDate: Date;
  todayEvents: CalendarEvent[];
  todayTasks: TaskListItem[];
  alerts: RescheduleReminder[];
  saving: boolean;
  onClose: () => void;
  onSkipNextTime: () => void;
}) {
  const displayName = accountName.includes("@")
    ? accountName.split("@")[0]
    : accountName;

  const openTasks = todayTasks.filter((task) => !task.done);
  const pendingAlerts = alerts.filter((alert) => !alert.done);

  const nextEvent = todayEvents[0];
  const nextTask = openTasks[0];
  const nextAlert = pendingAlerts[0];

  const summary =
    todayEvents.length === 0 &&
    openTasks.length === 0 &&
    pendingAlerts.length === 0
      ? "Your selected day is open. Nothing urgent is waiting."
      : [
          todayEvents.length > 0
            ? `${todayEvents.length} event${todayEvents.length === 1 ? "" : "s"}`
            : null,
          openTasks.length > 0
            ? `${openTasks.length} open task${openTasks.length === 1 ? "" : "s"}`
            : null,
          pendingAlerts.length > 0
            ? `${pendingAlerts.length} alert${pendingAlerts.length === 1 ? "" : "s"}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <ModalShell>
      <div className="w-full max-w-sm overflow-hidden rounded-[30px] border border-white/70 bg-white/95 shadow-2xl shadow-[#6d5dfc]/20 backdrop-blur-2xl">
        <div className="relative overflow-hidden bg-[#f6f4ff] p-4">
          <div className="pointer-events-none absolute -left-16 -top-16 size-36 rounded-full bg-[#ff9bd2]/45 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 top-6 size-36 rounded-full bg-[#7dd3fc]/50 blur-3xl" />

          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#af52de]">
                Welcome back
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-[#18181b]">
                Hi {displayName}
              </h2>
              <p className="mt-1 text-sm font-bold leading-5 text-[#636366]">
                {formatLongDate(selectedDate)}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-white/80 text-[#636366] shadow-lg shadow-black/5"
              aria-label="Close intro"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div className="rounded-[24px] bg-[#f8f7ff] p-4 text-center shadow-sm shadow-black/5">
            <p className="text-sm font-black text-[#18181b]">Today’s summary</p>
            <p className="mt-2 text-sm font-bold leading-6 text-[#636366]">
              {summary}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-[#f8f7ff] p-3 text-center">
              <p className="text-xl font-black text-[#007aff]">
                {todayEvents.length}
              </p>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8e8e93]">
                Events
              </p>
            </div>

            <div className="rounded-2xl bg-[#f8f7ff] p-3 text-center">
              <p className="text-xl font-black text-[#34c759]">
                {openTasks.length}
              </p>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8e8e93]">
                Tasks
              </p>
            </div>

            <div className="rounded-2xl bg-[#f8f7ff] p-3 text-center">
              <p className="text-xl font-black text-[#ff9500]">
                {pendingAlerts.length}
              </p>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8e8e93]">
                Alerts
              </p>
            </div>
          </div>

          {(nextEvent || nextTask || nextAlert) && (
            <div className="rounded-[24px] bg-white p-3 shadow-lg shadow-black/5">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-[#8e8e93]">
                Next up
              </p>

              {nextEvent && (
                <div className="flex items-center gap-2 rounded-2xl bg-[#f8f7ff] px-3 py-2">
                  <CalendarDays size={15} className="text-[#007aff]" />
                  <span className="min-w-0 flex-1 truncate text-xs font-black text-[#18181b]">
                    {nextEvent.time} · {nextEvent.title}
                  </span>
                </div>
              )}

              {!nextEvent && nextTask && (
                <div className="flex items-center gap-2 rounded-2xl bg-[#f8f7ff] px-3 py-2">
                  <ListChecks size={15} className="text-[#34c759]" />
                  <span className="min-w-0 flex-1 truncate text-xs font-black text-[#18181b]">
                    {nextTask.title}
                  </span>
                </div>
              )}

              {!nextEvent && !nextTask && nextAlert && (
                <div className="flex items-center gap-2 rounded-2xl bg-[#f8f7ff] px-3 py-2">
                  <BellRing size={15} className="text-[#ff9500]" />
                  <span className="min-w-0 flex-1 truncate text-xs font-black text-[#18181b]">
                    {nextAlert.time} · {nextAlert.title}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onSkipNextTime}
              disabled={saving}
              className="h-11 rounded-full bg-[#f2f2f7] text-xs font-black text-[#636366] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Don’t show again"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-full bg-[#007aff] text-xs font-black text-white shadow-lg shadow-[#007aff]/25"
            >
              Open calendar
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  danger,
  onClose,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell>
      <div className="w-full max-w-md rounded-[32px] border border-white/70 bg-white/92 p-4 shadow-2xl shadow-black/20 backdrop-blur-2xl">
        <ModalHeader title={title} eyebrow="Please confirm" onClose={onClose} />
        <p className="text-sm font-semibold leading-6 text-[#636366]">{body}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            className="h-12 rounded-full bg-[#f2f2f7] text-base font-bold"
            onClick={onClose}
          >
            Keep it
          </button>
          <button
            type="button"
            className={[
              "h-12 rounded-full text-base font-bold text-white shadow-lg",
              danger
                ? "bg-[#ff3b30] shadow-[#ff3b30]/25"
                : "bg-[#007aff] shadow-[#007aff]/25",
            ].join(" ")}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function DeleteAccountModal({
  value,
  onChange,
  onClose,
  onConfirm,
}: {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell>
      <div className="w-full max-w-md rounded-[32px] border border-white/70 bg-white/92 p-4 shadow-2xl shadow-black/20 backdrop-blur-2xl">
        <ModalHeader
          title="Are you sure you want to delete your account?"
          eyebrow="Danger Zone"
          onClose={onClose}
        />
        <p className="text-sm font-semibold leading-6 text-[#636366]">
          This is intentionally blocked until Supabase Auth admin deletion is
          configured. Type DELETE to test the confirmation flow.
        </p>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="input-shell mt-4 w-full"
          placeholder="Type DELETE"
        />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            className="h-12 rounded-full bg-[#f2f2f7] text-base font-bold"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={value !== "DELETE"}
            className="h-12 rounded-full bg-[#ff3b30] text-base font-bold text-white shadow-lg shadow-[#ff3b30]/25 disabled:opacity-45"
            onClick={onConfirm}
          >
            Delete account
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function DesktopPanel({
  selectedDate,
  events,
  reminders,
  tasks,
  alerts,
}: {
  selectedDate: Date;
  events: CalendarEvent[];
  reminders: RescheduleReminder[];
  tasks: Array<{
    id: string;
    title: string;
    done: boolean;
    eventTitle: string;
  }>;
  alerts: RescheduleReminder[];
}) {
  const overviewItems = [
    { label: "Events", value: events.length },
    { label: "Tasks", value: tasks.filter((task) => !task.done).length },
    { label: "Alerts", value: alerts.length + reminders.length },
  ];

  return (
    <>
      <section className="rounded-[36px] border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-2xl shadow-[var(--shadow-soft)] backdrop-blur-3xl">
        <p className="text-sm font-bold text-[var(--muted)]">Desktop overview</p>
        <h2 className="mt-1 text-3xl font-semibold text-[var(--foreground)]">
          {formatLongDate(selectedDate)}
        </h2>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {overviewItems.map((item) => (
            <div
              key={item.label}
              className="rounded-[30px] border border-[var(--border-soft)] bg-[var(--surface)] p-6 text-center shadow-lg shadow-[var(--shadow-soft)] backdrop-blur-xl"
            >
              <p className="text-4xl font-black text-[var(--foreground)]">
                {item.value}
              </p>
              <p className="mt-2 text-sm font-bold text-[var(--muted)]">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className="overflow-y-auto rounded-[36px] border border-[var(--border-soft)] bg-[var(--surface)] p-6 pb-10 shadow-2xl shadow-[var(--shadow-soft)] backdrop-blur-3xl">
        <SectionTitle
          eyebrow="Planner"
          title="Selected day at a glance"
          count={events.length}
        />
        <div className="grid grid-cols-2 gap-4">
          {events.map((event) => (
            <article
              key={event.id}
              className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4 shadow-lg shadow-[var(--shadow-soft)]"
            >
              <h3 className="text-base font-semibold text-[var(--foreground)]">
                {event.title}
              </h3>
              <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                {event.time} · {event.location}
              </p>
              {event.tasks.filter((task) => !task.done).length > 0 && (
                <div className="mt-3 space-y-1">
                  {event.tasks
                    .filter((task) => !task.done)
                    .map((task) => (
                      <p
                        key={task.id}
                        className="text-sm font-semibold text-[var(--muted)]"
                      >
                        • {task.title}
                      </p>
                    ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function BottomTabs({
  activeTab,
  setActiveTab,
  hasNewAlerts,
}: {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  hasNewAlerts: boolean;
}) {
  const items = [
    { id: "calendar" as const, label: "Calendar", icon: CalendarDays },
    { id: "tasks" as const, label: "Tasks", icon: ListChecks },
    { id: "alerts" as const, label: "Alerts", icon: Bell },
    { id: "stats" as const, label: "Stats", icon: BarChart3 },
    { id: "settings" as const, label: "Settings", icon: Shield },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-white/50 bg-white/58 px-5 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 backdrop-blur-2xl lg:static lg:mx-0 lg:max-w-none lg:shrink-0 lg:rounded-b-[36px] lg:px-5 lg:pb-3">
      <div className="grid grid-cols-5 text-[11px] font-bold">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={[
              "relative flex h-14 flex-col items-center justify-center gap-1 rounded-2xl transition active:scale-95",
              activeTab === item.id ? "text-[#007aff]" : "text-[#8e8e93]",
            ].join(" ")}
          >
            {hasNewAlerts && item.id === "alerts" && (
              <span className="absolute -top-1 -right-1 flex size-3 items-center justify-center rounded-full bg-[#ff3b30] shadow-lg" />
            )}
            <item.icon
              size={22}
              strokeWidth={activeTab === item.id ? 2.5 : 2.1}
            />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function ReminderCard({ reminder }: { reminder: RescheduleReminder }) {
  return (
    <article className="rounded-[24px] border border-white/60 bg-white/70 p-4 shadow-lg shadow-black/5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-[#fff3cd] text-[#b46900]">
          <RotateCcw size={18} />
        </span>
        <div className="min-w-0">
          <h4 className="truncate text-base font-semibold">{reminder.title}</h4>
          <p className="text-sm font-semibold text-[#7c7c8a]">
            {reminder.date} at {reminder.time}
          </p>
        </div>
      </div>
    </article>
  );
}

function SectionTitle({
  eyebrow,
  title,
  count,
}: {
  eyebrow: string;
  title: string;
  count: number;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <p className="text-sm font-bold text-[#8e8e93]">{eyebrow}</p>
        <h2 className="text-2xl font-semibold tracking-normal">{title}</h2>
      </div>
      <span className="rounded-full bg-white/70 px-3 py-1 text-sm font-bold text-[#007aff] shadow-sm">
        {count}
      </span>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[28px] border border-white/60 bg-white/62 p-6 text-center shadow-lg backdrop-blur-2xl">
      <Sparkles className="mx-auto text-[#af52de]" size={26} />
      <p className="mt-2 text-base font-semibold">{title}</p>
      <p className="mt-1 text-sm font-medium text-[#7c7c8a]">{body}</p>
    </div>
  );
}

function Chip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1">
      {icon}
      {text}
    </span>
  );
}

function IconButton({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      className={[
        "grid size-8 place-items-center rounded-full bg-white/75 transition active:scale-95",
        danger ? "text-[#ff3b30]" : "text-[#007aff]",
      ].join(" ")}
      onClick={onClick}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-[26px] border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-center shadow-lg shadow-[var(--shadow-soft)] backdrop-blur-xl">
      <p className="text-4xl font-black text-[var(--foreground)]">
        {value}
      </p>
      <p className="mt-2 text-sm font-bold text-[var(--muted)]">
        {label}
      </p>
    </div>
  );
}

function SettingsCard({
  id,
  sectionId,
  activeSection,
  onSectionChange,
  title,
  icon,
  children,
}: {
  id?: string;
  sectionId: SettingsSectionId;
  activeSection: SettingsSectionId;
  onSectionChange: (section: SettingsSectionId) => void;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const open = activeSection === sectionId;

  return (
    <article
      id={id}
      className={[
        "rounded-[26px] border p-4 shadow-lg shadow-[var(--shadow-soft)] backdrop-blur-xl transition",
        open
          ? "border-[var(--accent)] bg-[var(--surface)]"
          : "border-[var(--border-soft)] bg-[var(--surface)]",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => onSectionChange(sectionId)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-3 text-[var(--accent)]">
          {icon}
          <h3 className="text-base font-bold text-[var(--foreground)]">
            {title}
          </h3>
        </span>

        <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-[11px] font-black text-[var(--muted)]">
          {open ? "Selected" : "Open"}
        </span>
      </button>

      {open && <div className="mt-4">{children}</div>}
    </article>
  );
}

function PlaceholderRow({
  title,
  danger,
}: {
  title: string;
  danger?: boolean;
}) {
  return (
    <div className="mt-2 flex items-center justify-between rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-bold">
      <span
        className={danger ? "text-[#ff453a]" : "text-[var(--muted)]"}
      >
        {title}
      </span>
      <span className="rounded-full bg-[var(--surface-strong)] px-2 py-1 text-[11px] text-[var(--muted)]">
        Coming soon
      </span>
    </div>
  );
}

function PlanCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-3 shadow-sm shadow-[var(--shadow-soft)]">
      <p className="text-sm font-bold text-[var(--foreground)]">{title}</p>
      <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
        {body}
      </p>
    </div>
  );
}

function ModalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-3 pb-3 backdrop-blur-md">
      {children}
    </div>
  );
}

function ModalHeader({
  title,
  eyebrow,
  onClose,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        {eyebrow && (
          <p className="text-sm font-bold text-[var(--muted)]">
            {eyebrow}
          </p>
        )}
        <h2 className="text-xl font-semibold text-[var(--foreground)]">
          {title}
        </h2>
      </div>
      <button
        type="button"
        className="grid size-9 place-items-center rounded-full bg-[var(--surface-muted)] text-[var(--muted)]"
        onClick={onClose}
        aria-label="Close"
      >
        <X size={19} />
      </button>
    </div>
  );
}

function Toggle({
  checked,
  label,
  onClick,
}: {
  checked: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 w-full items-center justify-between rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 text-sm font-bold text-[var(--foreground)] transition hover:brightness-105"
    >
      <span className="pr-3 text-left">{label}</span>
      <span
        className={[
          "flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition",
          checked ? "bg-[#34c759]" : "bg-[#c7c7cc]",
        ].join(" ")}
      >
        <span
          className={[
            "size-6 rounded-full bg-white shadow-sm transition",
            checked ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </span>
    </button>
  );
}

function ToastViewport({
  toasts,
  onClose,
}: {
  toasts: ToastItem[];
  onClose: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[min(92vw,380px)] flex-col gap-3">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onClose,
}: {
  toast: ToastItem;
  onClose: (id: string) => void;
}) {
  const toneStyles =
    toast.tone === "success"
      ? "border-emerald-200/70 bg-[var(--surface)] text-[var(--foreground)]"
      : toast.tone === "error"
        ? "border-rose-200/70 bg-[var(--surface)] text-[var(--foreground)]"
        : toast.tone === "warning"
          ? "border-amber-200/70 bg-[var(--surface)] text-[var(--foreground)]"
          : "border-sky-200/70 bg-[var(--surface)] text-[var(--foreground)]";

  const accent =
    toast.tone === "success"
      ? "bg-emerald-500"
      : toast.tone === "error"
        ? "bg-rose-500"
        : toast.tone === "warning"
          ? "bg-amber-500"
          : "bg-sky-500";

  return (
    <div
      className={[
        "pointer-events-auto overflow-hidden rounded-[24px] border shadow-2xl backdrop-blur-2xl transition-all duration-200",
        toast.visible
          ? "translate-y-0 scale-100 opacity-100"
          : "-translate-y-2 scale-[0.98] opacity-0",
        toneStyles,
      ].join(" ")}
    >
      <div className="flex items-start gap-3 p-4">
        <div
          className={[
            "mt-0.5 grid size-9 shrink-0 place-items-center rounded-full text-white",
            accent,
          ].join(" ")}
        >
          {toast.tone === "success" ? (
            <Check size={18} />
          ) : toast.tone === "error" ? (
            <CircleX size={18} />
          ) : toast.tone === "warning" ? (
            <Shield size={18} />
          ) : (
            <Bell size={18} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-6">{toast.message}</p>
        </div>

        <button
          type="button"
          onClick={() => onClose(toast.id)}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--surface-muted)] text-[var(--muted)] transition hover:brightness-95"
          aria-label="Dismiss notification"
        >
          <X size={16} />
        </button>
      </div>

      <div className="h-1 w-full bg-[var(--surface-muted)]">
        <div
          className={[
            "h-1 origin-left animate-[toastbar_3.4s_linear_forwards]",
            accent,
          ].join(" ")}
        />
      </div>
    </div>
  );
}

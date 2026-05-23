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
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AppSession,
  clearSession,
  legacySessionStorageKey,
  readSession,
  readSessionSnapshot,
  sessionStorageKey,
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
} from "@/lib/free-tier";
import { BrandMark } from "@/components/brand/brand-mark";

type AppTab = "calendar" | "tasks" | "alerts" | "stats" | "settings";
type ComposerKind = "event" | "task";

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
  reminderDate: string;
  reminderTime: string;
  eventId: string | null;
  eventTitle: string;
};

type TaskDraft = {
  title: string;
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
};

type CalendarData = {
  tags: CategoryStyle[];
  calendars: AppCalendar[];
  events: CalendarEvent[];
  standaloneTasks: StandaloneTask[];
  eventReminders: RescheduleReminder[];
  settings: AppSettings;
};

type DbMember = {
  id: string;
  email: string;
  displayName?: string | null;
  role: "owner" | "editor" | "viewer";
  status: "pending" | "accepted";
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

type DbCategory = {
  id: string;
  name: string;
  color: string;
  icon?: string | null;
};

type DbTask = {
  id: string;
  eventId?: string | null;
  title: string;
  description?: string | null;
  completed: boolean;
  dueDate?: string | null;
  event?: { id: string; title: string; status?: CalendarEvent["status"] } | null;
};

type DbReminder = {
  id: string;
  eventId?: string | null;
  title: string;
  remindAt: string;
  completed: boolean;
};

type DbEvent = {
  id: string;
  calendarId?: string | null;
  categoryId?: string | null;
  createdById?: string | null;
  updatedById?: string | null;
  title: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  allDay: boolean;
  color?: string | null;
  location?: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  pinned: boolean;
  status: CalendarEvent["status"];
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  calendar?: DbCalendar | null;
  category?: DbCategory | null;
  tasks: DbTask[];
  reminders: DbReminder[];
  shares?: Array<{ id: string; email: string; role: "editor" | "viewer"; status: "pending" | "accepted" }>;
};

const viewOptions: CalendarView[] = ["month", "week", "day"];
const recurrences: Recurrence[] = ["none", "daily", "weekly", "monthly", "yearly"];
const timelineSlots = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
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

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random()}`;
}

function currentTimeValue(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

function readCalendarData(session: AppSession | null, today: Date): CalendarData {
  const fallback = {
    tags: Object.values(categoryStyles),
    calendars: [],
    events: createInitialEvents(today),
    standaloneTasks: [],
    eventReminders: [],
    settings: defaultSettings,
  };

  if (session && typeof window !== "undefined") {
    localStorage.removeItem(sessionStorageKey(session));
    localStorage.removeItem(legacySessionStorageKey(session));
  }

  return fallback;
}

async function apiJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }
  return payload as T;
}

function mapCalendar(calendar: DbCalendar, session: AppSession | null): AppCalendar {
  const ownMember = calendar.members.find((member) => member.userId === session?.user.id);
  return {
    id: calendar.id,
    name: calendar.name,
    color: calendar.color,
    visible: calendar.visible,
    shared: calendar.shared || calendar.members.length > 1,
    role: calendar.ownerId === session?.user.id ? "owner" : ownMember?.role ?? "viewer",
    members: calendar.members.map((member) => ({
      id: member.id,
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

function formatDuration(startDate: string, endDate?: string | null) {
  if (!endDate) return "30m";
  const minutes = Math.max(
    15,
    Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 60000),
  );
  return minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}m`;
}

function mapReminder(reminder: DbReminder): RescheduleReminder {
  const date = new Date(reminder.remindAt);
  return {
    id: reminder.id,
    eventId: reminder.eventId ?? "none",
    title: reminder.title,
    date: toDateKey(date),
    time: currentTimeValue(date),
    done: reminder.completed,
  };
}

function mapEvent(event: DbEvent): CalendarEvent {
  const start = new Date(event.startDate);
  return {
    id: event.id,
    calendarId: event.calendarId ?? undefined,
    title: event.title,
    date: toDateKey(start),
    time: event.allDay ? "All day" : currentTimeValue(start),
    duration: formatDuration(event.startDate, event.endDate),
    category: event.categoryId ?? event.category?.id ?? "uncategorized",
    priority: event.priority === "urgent" ? "high" : event.priority,
    recurrence: "none",
    location: event.location ?? "No location",
    notes: event.description ?? "",
    allDay: event.allDay,
    pinned: event.pinned,
    status: event.status,
    cancellationReason: event.cancellationReason ?? undefined,
    cancelledAt: event.cancelledAt ?? undefined,
    createdBy: event.createdById ?? undefined,
    lastEditedBy: event.updatedById ?? undefined,
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

function dateTimeFromDraft(date: string, time: string, allDay: boolean) {
  return allDay ? `${date}T00:00:00` : `${date}T${time || "09:00"}:00`;
}

function minutesFromDuration(duration: string) {
  if (duration.endsWith("h")) return Number(duration.replace("h", "")) * 60 || 60;
  return Number(duration.replace("m", "")) || 30;
}

function parseReminderMinutes(label: string) {
  if (label === "At time of event") return 0;
  if (label.includes("hour")) return 60;
  if (label.includes("day")) return 1440;
  return Number(label.match(/\d+/)?.[0] ?? 15);
}

function emptyDraft(date: Date, category: string): EventDraft {
  return {
    calendarId: "personal",
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
    calendarId: event.calendarId ?? "personal",
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

function subscribeSessionStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

export default function CalendarDashboard() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const firedAlerts = useRef<Set<string>>(new Set());
  const sessionSnapshot = useSyncExternalStore(
    subscribeSessionStorage,
    readSessionSnapshot,
    () => "__server__",
  );
  const session = useMemo(
    () => (sessionSnapshot && sessionSnapshot !== "__server__" ? readSession() : null),
    [sessionSnapshot],
  );
  const isAuthed = Boolean(session);
  const initialData = useMemo(() => readCalendarData(session, today), [session, today]);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState<CalendarView>("month");
  const [activeTab, setActiveTab] = useState<AppTab>("calendar");
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<CategoryStyle[]>(() => initialData.tags);
  const [calendars, setCalendars] = useState<AppCalendar[]>(() => initialData.calendars);
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [events, setEvents] = useState(() => initialData.events);
  const [settings, setSettings] = useState<AppSettings>(() => initialData.settings);
  const [calendarDraft, setCalendarDraft] = useState({ name: "", color: "#007aff" });
  const [memberDraft, setMemberDraft] = useState({
    calendarId: "work",
    email: "",
    role: "viewer" as "editor" | "viewer",
  });
  const [shareDrafts, setShareDrafts] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EventDraft>(() => emptyDraft(today, "hobby"));
  const [eventReminderDraft, setEventReminderDraft] = useState<ReminderDraft>({
    enabled: false,
    date: toDateKey(today),
    time: currentTimeValue(today),
  });
  const [eventReminders, setEventReminders] = useState<RescheduleReminder[]>(
    () => initialData.eventReminders,
  );
  const [composerKind, setComposerKind] = useState<ComposerKind>("event");
  const [standaloneTasks, setStandaloneTasks] = useState<StandaloneTask[]>(
    () => initialData.standaloneTasks,
  );
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>({
    title: "",
    reminderDate: toDateKey(today),
    reminderTime: currentTimeValue(today),
    eventId: "none",
  });
  const [eventTaskDrafts, setEventTaskDrafts] = useState<Record<string, string>>({});
  const [composerOpen, setComposerOpen] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState<TagDraft>({
    label: "",
    icon: "tag",
    color: "#007aff",
  });
  const [cancelTarget, setCancelTarget] = useState<CalendarEvent | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [rescheduleTarget, setRescheduleTarget] = useState<CalendarEvent | null>(null);
  const [rescheduleDraft, setRescheduleDraft] = useState({
    date: toDateKey(addDays(today, 1)),
    time: "09:00",
  });
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceMessage, setWorkspaceMessage] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [deleteCalendarTarget, setDeleteCalendarTarget] = useState<AppCalendar | null>(null);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteAccountText, setDeleteAccountText] = useState("");

  const selectedKey = toDateKey(selectedDate);
  const monthDays = useMemo(() => getMonthDays(visibleMonth), [visibleMonth]);
  const tagMap = useMemo(
    () => Object.fromEntries(tags.map((tag) => [tag.id, tag])),
    [tags],
  );
  const visibleCalendarIds = useMemo(
    () => new Set(calendars.filter((calendar) => calendar.visible).map((calendar) => calendar.id)),
    [calendars],
  );

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return events
      .filter((event) => {
        const tag = tagMap[event.category];
        const matchesCategory =
          activeCategory === "all" || event.category === activeCategory;
        const matchesCalendar = visibleCalendarIds.has(event.calendarId ?? "personal");
        const matchesQuery =
          !normalizedQuery ||
          [event.title, event.location, event.notes, tag?.label]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);

        return matchesCalendar && matchesCategory && matchesQuery && event.status !== "archived";
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.time.localeCompare(b.time));
  }, [activeCategory, events, query, tagMap, visibleCalendarIds]);

  const selectedEvents = filteredEvents.filter((event) => event.date === selectedKey);
  const selectedReminders = events
    .flatMap((event) => event.rescheduleReminders)
    .filter((reminder) => reminder.date === selectedKey && !reminder.done)
    .sort((a, b) => a.time.localeCompare(b.time));
  const weekDays = getWeekDays(selectedDate);
  const taskItems = useMemo(
    (): TaskListItem[] => [
      ...events.flatMap((event) =>
        event.tasks.map((task) => ({
          ...task,
          eventId: event.id,
          eventTitle: event.title,
          eventStatus: event.status,
        })),
      ),
      ...standaloneTasks,
    ],
    [events, standaloneTasks],
  );
  const alertItems = useMemo(
    () =>
      events
        .flatMap((event) => event.rescheduleReminders)
        .concat(eventReminders)
        .concat(
          standaloneTasks
            .filter((task) => !task.done)
            .map((task) => ({
              id: `task-alert-${task.id}`,
              eventId: task.eventId ?? "none",
              title: `Task reminder: ${task.title}`,
              date: task.reminderDate,
              time: task.reminderTime,
              done: task.done,
            })),
        )
        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
    [eventReminders, events, standaloneTasks],
  );
  const unboundUndoneTasks = useMemo(
    () => standaloneTasks.filter((task) => !task.done && !task.eventId),
    [standaloneTasks],
  );
  const stats = useMemo(
    () => computeStats(filteredEvents, taskItems, tags),
    [filteredEvents, taskItems, tags],
  );
  const aiSuggestions = useMemo(
    () => buildAiSuggestions(stats, filteredEvents),
    [filteredEvents, stats],
  );
  const notificationPermission =
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported";

  async function loadWorkspace() {
    if (!session) return;
    setWorkspaceLoading(true);
    setWorkspaceMessage("");
    try {
      const [userPayload, calendarPayload, categoryPayload, eventPayload, taskPayload, reminderPayload, preferencePayload] =
        await Promise.all([
          apiJson<{ user: AppSession["user"] & { theme?: AppSettings["theme"] } }>("/api/users/me"),
          apiJson<{ calendars: DbCalendar[]; limit: number }>("/api/calendars"),
          apiJson<{ categories: DbCategory[] }>("/api/categories"),
          apiJson<{ events: DbEvent[] }>("/api/events"),
          apiJson<{ tasks: DbTask[] }>("/api/tasks"),
          apiJson<{ reminders: DbReminder[] }>("/api/reminders"),
          apiJson<{
            preferences: {
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
          }>("/api/settings/notifications"),
        ]);

      let loadedCategories = categoryPayload.categories;
      if (loadedCategories.length === 0) {
        loadedCategories = await Promise.all(
          Object.values(categoryStyles).map(async (category) => {
            const payload = await apiJson<{ category: DbCategory }>("/api/categories", {
              method: "POST",
              body: JSON.stringify({
                name: category.label,
                color: category.color,
                icon: category.icon,
              }),
            });
            return payload.category;
          }),
        );
      }

      let loadedCalendars = calendarPayload.calendars;
      if (loadedCalendars.length === 0) {
        const payload = await apiJson<{ calendar: DbCalendar }>("/api/calendars", {
          method: "POST",
          body: JSON.stringify({ name: "My Calendar", color: "#007aff" }),
        });
        loadedCalendars = [payload.calendar];
      }

      const mappedCalendars = loadedCalendars.map((calendar) => mapCalendar(calendar, session));
      const calendarDisplayNames = Object.fromEntries(
        loadedCalendars
          .map((calendar) => {
            const ownMember = calendar.members.find((member) => member.userId === session.user.id);
            return [calendar.id, ownMember?.displayName ?? ""];
          })
          .filter(([, value]) => value),
      ) as Record<string, string>;
      const preferences = preferencePayload.preferences;
      const mappedSettings: AppSettings = {
        ...defaultSettings,
        theme: userPayload.user.theme ?? "system",
        profile: {
          accountName: userPayload.user.name ?? "",
          calendarDisplayNames,
        },
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
          defaultTiming: `${preferences.defaultReminderMinutes} minutes before`,
        },
        ai: {
          enabled: preferences.aiEnabled,
          scheduling: preferences.aiScheduling,
          insights: preferences.aiInsights,
          reschedule: false,
          weeklySummary: preferences.aiWeeklySummary,
          privateMode: preferences.privateMode,
        },
      };

      setCalendars(mappedCalendars);
      setTags(loadedCategories.map(mapCategory));
      setEvents(eventPayload.events.map(mapEvent));
      setEventReminders(reminderPayload.reminders.filter((reminder) => !reminder.eventId).map(mapReminder));
      setStandaloneTasks(
        taskPayload.tasks
          .filter((task) => !task.eventId)
          .map((task) => ({
            id: task.id,
            title: task.title,
            done: task.completed,
            reminderDate: task.dueDate ? toDateKey(new Date(task.dueDate)) : toDateKey(today),
            reminderTime: task.dueDate ? currentTimeValue(new Date(task.dueDate)) : currentTimeValue(),
            eventId: null,
            eventTitle: "Standalone task",
          })),
      );
      setSettings(mappedSettings);
      setMemberDraft((current) => ({
        ...current,
        calendarId: mappedCalendars[0]?.id ?? current.calendarId,
      }));
      setWorkspaceMessage("Workspace loaded from your account.");
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : "Could not load workspace.");
    } finally {
      setWorkspaceLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadWorkspace(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    root.classList.toggle("dark", settings.theme === "dark");
    localStorage.setItem("arcgenda-theme-hydration", settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    if (!isAuthed) return;

    const checkAlerts = () => {
      const now = new Date();
      alertItems.forEach((item) => {
        const due = new Date(`${item.date}T${item.time}`);
        if (due <= now && !firedAlerts.current.has(item.id)) {
          firedAlerts.current.add(item.id);
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Arcgenda", { body: item.title });
          } else {
            window.alert(item.title);
          }
        }
      });
    };

    checkAlerts();
    const interval = window.setInterval(checkAlerts, 30000);
    return () => window.clearInterval(interval);
  }, [alertItems, isAuthed]);

  function tagFor(event: CalendarEvent) {
    return tagMap[event.category] ?? tags[0];
  }

  function movePeriod(direction: -1 | 1) {
    if (view === "month") {
      setVisibleMonth(
        new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + direction, 1),
      );
      return;
    }

    const nextDate = addDays(selectedDate, view === "week" ? direction * 7 : direction);
    setSelectedDate(nextDate);
    setVisibleMonth(startOfMonth(nextDate));
  }

  function selectDate(date: Date) {
    setSelectedDate(date);
    setVisibleMonth(startOfMonth(date));
    setActiveTab("calendar");
  }

  function openNewEvent() {
    setEditingId(null);
    const now = new Date();
    setComposerKind("event");
    setDraft({
      ...emptyDraft(selectedDate, tags[0]?.id ?? "hobby"),
      calendarId: calendars.find((calendar) => calendar.visible)?.id ?? "personal",
      time: currentTimeValue(now),
    });
    setEventReminderDraft({
      enabled: false,
      date: toDateKey(selectedDate),
      time: currentTimeValue(now),
    });
    setSelectedTaskIds([]);
    setTaskDraft({
      title: "",
      reminderDate: toDateKey(selectedDate),
      reminderTime: currentTimeValue(now),
      eventId: "none",
    });
    setComposerOpen(true);
  }

  function openEditEvent(event: CalendarEvent) {
    if (event.status === "cancelled") return;
    setEditingId(event.id);
    setComposerKind("event");
    setDraft(eventToDraft(event));
    setSelectedTaskIds([]);
    setComposerOpen(true);
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = taskDraft.title.trim();
    if (!title) return;

    try {
      await apiJson<{ task: DbTask }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title,
          eventId: taskDraft.eventId === "none" ? undefined : taskDraft.eventId,
          dueDate: `${taskDraft.reminderDate}T${taskDraft.reminderTime}:00`,
        }),
      });
      await loadWorkspace();
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : "Could not create task.");
      return;
    }

    setTaskDraft({
      title: "",
      reminderDate: toDateKey(selectedDate),
      reminderTime: currentTimeValue(),
      eventId: "none",
    });
    requestNotificationPermission();
    setComposerOpen(false);
    setActiveTab("tasks");
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) return;

    const previous = events.find((item) => item.id === editingId);
    const nextCalendar = calendars.find((calendar) => calendar.id === draft.calendarId);
    const previousCalendar = calendars.find((calendar) => calendar.id === previous?.calendarId);
    if (
      previous &&
      nextCalendar &&
      previousCalendar &&
      previousCalendar.shared !== nextCalendar.shared &&
      !window.confirm(`Move "${previous.title}" from ${previousCalendar.name} to ${nextCalendar.name}? Linked tasks and reminders will stay attached.`)
    ) {
      return;
    }

    try {
      const startDate = dateTimeFromDraft(draft.date, draft.time, draft.allDay);
      const endDate = new Date(new Date(startDate).getTime() + minutesFromDuration(draft.duration) * 60000).toISOString();
      const payload = {
        calendarId: draft.calendarId,
        categoryId: draft.category,
        title,
        description: draft.notes.trim(),
        startDate,
        endDate,
        allDay: draft.allDay,
        location: draft.location.trim() || "No location",
        priority: previous?.priority ?? "normal",
        pinned: draft.pinned,
      };
      const saved = editingId
        ? await apiJson<{ event: DbEvent }>(`/api/events/${editingId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await apiJson<{ event: DbEvent }>("/api/events", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      await Promise.all(
        selectedTaskIds.map((taskId) =>
          apiJson(`/api/tasks/${taskId}`, {
            method: "PATCH",
            body: JSON.stringify({ eventId: saved.event.id }),
          }),
        ),
      );

      if (eventReminderDraft.enabled) {
        await apiJson("/api/reminders", {
          method: "POST",
          body: JSON.stringify({
            eventId: saved.event.id,
            title: `Event reminder: ${title}`,
            remindAt: `${eventReminderDraft.date}T${eventReminderDraft.time}:00`,
          }),
        });
        requestNotificationPermission();
      }
      await loadWorkspace();
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : "Could not save event.");
      return;
    }

    const nextDate = fromDateKey(draft.date);
    setSelectedDate(nextDate);
    setVisibleMonth(startOfMonth(nextDate));
    setComposerOpen(false);
    setEditingId(null);
    setSelectedTaskIds([]);
  }

  async function deleteEvent(id: string) {
    try {
      await apiJson(`/api/events/${id}`, { method: "DELETE" });
      await loadWorkspace();
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : "Could not archive event.");
    }
  }

  async function confirmCancelEvent() {
    if (!cancelTarget) return;
    try {
      const payload = await apiJson<{ event: DbEvent }>(`/api/events/${cancelTarget.id}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({ cancellationReason }),
      });
      const cancelledEvent = mapEvent(payload.event);
      await loadWorkspace();
      setCancelTarget(null);
      setCancellationReason("");
      setRescheduleTarget(cancelledEvent);
      setRescheduleDraft({
        date: toDateKey(addDays(fromDateKey(cancelTarget.date), 1)),
        time: "09:00",
      });
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : "Could not cancel event.");
    }
  }

  async function undoCancelEvent(id: string) {
    try {
      await apiJson(`/api/events/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "scheduled" }),
      });
      await loadWorkspace();
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : "Could not restore event.");
    }
  }

  async function createRescheduleReminder() {
    if (!rescheduleTarget) return;
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
      await loadWorkspace();
      selectDate(fromDateKey(rescheduleDraft.date));
      setActiveTab("alerts");
      setRescheduleTarget(null);
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : "Could not create reminder.");
    }
  }

  async function toggleTask(taskId: string) {
    const task =
      standaloneTasks.find((item) => item.id === taskId) ??
      events.flatMap((event) => event.tasks).find((item) => item.id === taskId);
    if (!task) return;
    try {
      await apiJson(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: !task.done }),
      });
      await loadWorkspace();
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : "Could not update task.");
    }
  }

  async function createTaskForEvent(eventId: string) {
    const title = eventTaskDrafts[eventId]?.trim();
    if (!title) return;

    try {
      await apiJson("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ eventId, title }),
      });
      await loadWorkspace();
      setEventTaskDrafts((current) => ({ ...current, [eventId]: "" }));
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : "Could not create linked task.");
    }
  }

  async function linkTaskToEvent(eventId: string, taskId: string) {
    try {
      await apiJson(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ eventId }),
      });
      await loadWorkspace();
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : "Could not link task.");
    }
  }

  async function unlinkTaskFromEvent(_eventId: string, taskId: string) {
    try {
      await apiJson(`/api/tasks/${taskId}/unlink-event`, { method: "PATCH" });
      await loadWorkspace();
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : "Could not unlink task.");
    }
  }

  async function deleteTask(taskId: string) {
    try {
      await apiJson(`/api/tasks/${taskId}`, { method: "DELETE" });
      await loadWorkspace();
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : "Could not delete task.");
    }
  }

  async function createCalendar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = calendarDraft.name.trim();
    if (!name || calendars.length >= 3) return;

    try {
      await apiJson("/api/calendars", {
        method: "POST",
        body: JSON.stringify({ name, color: calendarDraft.color }),
      });
      await loadWorkspace();
      setCalendarDraft({ name: "", color: "#007aff" });
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : "Could not create calendar.");
    }
  }

  function toggleCalendarVisibility(calendarId: string) {
    setCalendars((current) =>
      current.map((calendar) =>
        calendar.id === calendarId ? { ...calendar, visible: !calendar.visible } : calendar,
      ),
    );
  }

  async function addCalendarMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = memberDraft.email.trim().toLowerCase();
    if (!email) return;
    const selectedCalendar = calendars.find((calendar) => calendar.id === memberDraft.calendarId);
    const sharedCalendarUsed = calendars.some(
      (calendar) => calendar.shared && calendar.id !== memberDraft.calendarId,
    );
    if (!selectedCalendar || (!selectedCalendar.shared && sharedCalendarUsed)) return;

    try {
      await apiJson(`/api/calendars/${memberDraft.calendarId}/members`, {
        method: "POST",
        body: JSON.stringify({ email, role: memberDraft.role }),
      });
      await loadWorkspace();
      setMemberDraft((current) => ({ ...current, email: "" }));
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : "Could not add invite.");
    }
  }

  async function updateCalendar(calendarId: string, updates: { name?: string; color?: string }) {
    try {
      await apiJson(`/api/calendars/${calendarId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      await loadWorkspace();
      setWorkspaceMessage("Calendar saved.");
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : "Could not update calendar.");
    }
  }

  async function deleteCalendar() {
    if (!deleteCalendarTarget) return;
    try {
      await apiJson(`/api/calendars/${deleteCalendarTarget.id}`, { method: "DELETE" });
      await loadWorkspace();
      setWorkspaceMessage("Calendar deleted. Its events were archived.");
      setDeleteCalendarTarget(null);
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : "Could not delete calendar.");
    }
  }

  async function saveProfileSettings() {
    setSettingsMessage("");
    setSettingsError("");
    try {
      await Promise.all([
        apiJson("/api/users/me", {
          method: "PATCH",
          body: JSON.stringify({
            name: settings.profile.accountName,
            theme: settings.theme,
            calendarDisplayNames: settings.profile.calendarDisplayNames,
          }),
        }),
        apiJson("/api/settings/notifications", {
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
            defaultReminderMinutes: parseReminderMinutes(settings.notifications.defaultTiming),
            aiEnabled: settings.ai.enabled,
            aiScheduling: settings.ai.scheduling,
            aiInsights: settings.ai.insights,
            aiWeeklySummary: settings.ai.weeklySummary,
            privateMode: settings.ai.privateMode,
          }),
        }),
      ]);
      setSettingsMessage("Settings saved.");
      await loadWorkspace();
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Could not save settings.");
    }
  }

  async function requestAccountDeletion() {
    if (deleteAccountText !== "DELETE") return;
    try {
      await apiJson("/api/users/me", { method: "DELETE" });
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Account deletion is not configured yet.");
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
                { id: createId(), text: `Share prepared for ${email}`, at: new Date().toISOString() },
              ],
            }
          : event,
      ),
    );
    setShareDrafts((current) => ({ ...current, [eventId]: "" }));
  }

  function updateNotificationSetting(key: keyof AppSettings["notifications"], value: boolean | string) {
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

  async function createTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = tagDraft.label.trim();
    if (!label) return;

    try {
      const payload = await apiJson<{ category: DbCategory }>("/api/categories", {
        method: "POST",
        body: JSON.stringify({
          name: label,
          icon: tagDraft.icon.trim() || "tag",
          color: tagDraft.color,
        }),
      });
      const newTag = mapCategory(payload.category);
      setTags((current) => [...current, newTag]);
      setDraft((current) => ({ ...current, category: newTag.id }));
      setActiveCategory(newTag.id);
      setTagDraft({ label: "", icon: "tag", color: "#007aff" });
      setTagModalOpen(false);
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : "Could not create category.");
    }
  }

  return (
    <main className="h-dvh overflow-hidden bg-[#f6f4ff] text-[#18181b]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-[-80px] size-72 rounded-full bg-[#ff9bd2]/50 blur-3xl" />
        <div className="absolute right-[-90px] top-28 size-72 rounded-full bg-[#7dd3fc]/55 blur-3xl" />
        <div className="absolute bottom-[-120px] left-12 size-80 rounded-full bg-[#fef08a]/45 blur-3xl" />
      </div>

      <div className="relative mx-auto grid h-dvh w-full max-w-md overflow-hidden bg-white/42 shadow-2xl shadow-[#6d5dfc]/15 backdrop-blur-3xl lg:max-w-7xl lg:grid-cols-[430px_1fr] lg:gap-6 lg:bg-transparent lg:p-6 lg:shadow-none">
        <section className="flex h-dvh min-h-0 flex-col overflow-hidden bg-white/42 backdrop-blur-3xl lg:h-[calc(100dvh-48px)] lg:rounded-[36px] lg:border lg:border-white/55">
          <Header
            today={today}
            query={query}
            setQuery={setQuery}
            onAdd={openNewEvent}
            onLogout={() => {
              void createClient().auth.signOut();
              clearSession();
              router.replace("/login");
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
                  calendars={calendars}
                  shareDrafts={shareDrafts}
                  setShareDrafts={setShareDrafts}
                  onShareEvent={shareEvent}
                />
              </>
            )}
            {activeTab === "tasks" && (
              <TasksTab
                tasks={taskItems}
                onToggle={toggleTask}
                onDelete={deleteTask}
              />
            )}
            {activeTab === "alerts" && <AlertsTab alerts={alertItems} />}
            {activeTab === "stats" && (
              <StatsTab stats={stats} aiSuggestions={aiSuggestions} aiEnabled={settings.ai.enabled} />
            )}
            {activeTab === "settings" && (
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
                memberDraft={memberDraft}
                setMemberDraft={setMemberDraft}
                onAddMember={addCalendarMember}
                settings={settings}
                setSettings={setSettings}
                notificationPermission={notificationPermission}
                onNotificationChange={updateNotificationSetting}
                onAiChange={updateAiSetting}
                onSaveSettings={saveProfileSettings}
                onOpenDeleteAccount={() => setDeleteAccountOpen(true)}
              />
            )}
          </section>
          <BottomTabs activeTab={activeTab} setActiveTab={setActiveTab} />
        </section>

        <aside className="hidden min-h-[calc(100dvh-48px)] grid-rows-[auto_1fr] gap-6 lg:grid">
          <DesktopPanel
            selectedDate={selectedDate}
            events={selectedEvents}
            reminders={selectedReminders}
            tasks={taskItems}
            alerts={alertItems}
          />
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
          onReasonChange={setCancellationReason}
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
      {deleteCalendarTarget && (
        <ConfirmModal
          title={`Delete ${deleteCalendarTarget.name}?`}
          body="Deleting a calendar will archive its events in the current backend flow. This cannot be undone from this screen."
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
    </main>
  );
}

function Header({
  today,
  query,
  setQuery,
  onAdd,
  onLogout,
}: {
  today: Date;
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
            <p className="text-sm font-semibold text-[#7c7c8a]">{formatLongDate(today)}</p>
            <h1 className="text-3xl font-semibold tracking-normal">Arcgenda</h1>
          </div>
        </div>
        <button
          className="grid size-11 place-items-center rounded-full bg-[#1d1d1f] text-white shadow-lg shadow-black/20 transition active:scale-95"
          onClick={onAdd}
          aria-label="Add event"
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

      <label className="mt-5 flex h-11 items-center gap-2 rounded-full border border-white/65 bg-white/70 px-4 text-[#7c7c8a] shadow-sm backdrop-blur-xl">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#1d1d1f] outline-none placeholder:text-[#9b9baa]"
          placeholder="Search events, notes, places"
        />
      </label>

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
            view === option ? "bg-white text-[#007aff] shadow-sm" : "text-[#7c7c8a]",
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
      <button className="nav-circle" onClick={() => onMove(-1)} aria-label="Previous period">
        <ChevronLeft size={21} strokeWidth={2.6} />
      </button>
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-normal">{formatMonthYear(visibleMonth)}</h2>
        <p className="text-sm font-semibold text-[#7c7c8a]">{filteredCount} planned moments</p>
      </div>
      <button className="nav-circle" onClick={() => onMove(1)} aria-label="Next period">
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
          activeCategory === "all" ? "bg-[#1d1d1f] text-white" : "bg-white/70 text-[#7c7c8a]",
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
            background: activeCategory === tag.id ? tag.tint : "rgba(255,255,255,.7)",
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
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((day) => {
          const dayEvents = events.filter((event) => event.date === day.key);
          const selected = sameDate(day.date, selectedDate);
          const isToday = sameDate(day.date, today);
          return (
            <button
              key={day.key}
              onClick={() => onSelect(day.date)}
              className={[
                "mx-auto flex h-12 w-12 flex-col items-center justify-center rounded-2xl text-sm font-bold transition active:scale-95",
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
                    className={["size-1.5 rounded-full", event.status === "cancelled" ? "opacity-35" : ""].join(" ")}
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
              selected ? "bg-[#1d1d1f] text-white" : "bg-white/62 text-[#27272a]",
            ].join(" ")}
          >
            <span className="block text-xs font-bold uppercase opacity-70">
              {new Intl.DateTimeFormat("en", { weekday: "short" }).format(day)}
            </span>
            <span className="mt-1 block text-xl font-semibold">{day.getDate()}</span>
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
      <p className="text-sm font-bold text-[#8e8e93]">{formatLongDate(selectedDate)}</p>
      <div className="relative mt-4 space-y-3">
        {timelineSlots.map((slot) => (
          <div key={slot} className="grid grid-cols-[54px_1fr] gap-3">
            <span className="pt-1 text-xs font-bold text-[#9b9baa]">{slot}</span>
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
              style={{ top, background: tag.tint }}
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
                <span className="text-xs font-bold" style={{ color: tag.color }}>
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
          <h3 className="text-xl font-semibold tracking-normal">{formatLongDate(selectedDate)}</h3>
        </div>
        <span className="rounded-full bg-white/70 px-3 py-1 text-sm font-bold text-[#007aff] shadow-sm">
          {events.length} events
        </span>
      </div>
      <div className="space-y-3">
        {events.length === 0 ? (
          <EmptyState title="Nothing scheduled" body="Add an event or switch filters to see more." />
        ) : (
          events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              tag={tagFor(event)}
              onEdit={() => onEdit(event)}
              onCancel={() => onCancel(event)}
              onDelete={() => onDelete(event.id)}
              onUndoCancel={() => onUndoCancel(event.id)}
              unboundTasks={unboundTasks}
              taskDraft={taskDrafts[event.id] ?? ""}
              onTaskDraftChange={(value) => setTaskDrafts({ ...taskDrafts, [event.id]: value })}
              onCreateTask={() => onCreateTask(event.id)}
              onLinkTask={(taskId) => onLinkTask(event.id, taskId)}
              onToggleTask={onToggleTask}
              onUnlinkTask={(taskId) => onUnlinkTask(event.id, taskId)}
              onDeleteTask={onDeleteTask}
              calendar={calendars.find((calendar) => calendar.id === (event.calendarId ?? "personal"))}
              shareDraft={shareDrafts[event.id] ?? ""}
              onShareDraftChange={(value) => setShareDrafts({ ...shareDrafts, [event.id]: value })}
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
        "rounded-[28px] p-4 shadow-xl shadow-black/5 ring-1 ring-white/70 transition",
        cancelled ? "opacity-60 grayscale-[0.25]" : "",
      ].join(" ")}
      style={{ background: `linear-gradient(135deg, ${tag.tint}, rgba(255,255,255,.94))` }}
    >
      <div className="flex gap-3">
        <div className="mt-1 h-14 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {event.pinned && <Pin size={14} className="text-[#ff9500]" />}
                <h4 className={["truncate text-base font-semibold", cancelled ? "line-through decoration-2" : ""].join(" ")}>
                  {event.title}
                </h4>
                {cancelled && (
                  <span className="shrink-0 rounded-full bg-[#ffe8e6] px-2 py-0.5 text-[11px] font-bold uppercase text-[#c82d21]">
                    Cancelled
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm font-semibold text-[#7c7c8a]">
                {calendar?.name ?? "Personal"} · {event.recurrence === "none" ? "One-time" : event.recurrence} · {event.priority} priority
              </p>
              <p className="mt-1 text-xs font-bold text-[#8e8e93]">
                Created by {event.createdBy ?? "you"} · Last edited by {event.lastEditedBy ?? "you"}
              </p>
              {cancelled && event.cancellationReason && (
                <p className="mt-2 text-sm font-semibold text-[#8a5a55]">
                  Reason: {event.cancellationReason}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              {cancelled ? (
                <IconButton label={`Undo cancellation for ${event.title}`} onClick={onUndoCancel}>
                  <RotateCcw size={15} />
                </IconButton>
              ) : (
                <>
                  <IconButton label={`Edit ${event.title}`} onClick={onEdit}>
                    <Edit3 size={15} />
                  </IconButton>
                  <IconButton label={`Cancel ${event.title}`} onClick={onCancel} danger>
                    <CircleX size={16} />
                  </IconButton>
                </>
              )}
              <IconButton label={`Delete ${event.title}`} onClick={onDelete} danger>
                <Trash2 size={15} />
              </IconButton>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold text-[#636366]">
            <Chip icon={<Clock3 size={14} />} text={`${event.time} · ${event.duration}`} />
            <Chip icon={<MapPin size={14} />} text={event.location} />
            {event.tasks.length > 0 && <Chip icon={<Check size={14} />} text={`${doneTasks}/${event.tasks.length}`} />}
            {event.rescheduleReminders.length > 0 && <Chip icon={<RotateCcw size={14} />} text={`${event.rescheduleReminders.length} reschedule`} />}
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
              <p className="text-sm font-semibold text-[#8e8e93]">No linked tasks yet.</p>
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
                        task.done ? "bg-[#34c759] text-white" : "bg-[#f2f2f7] text-transparent",
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
                      <IconButton label={`Unlink ${task.title}`} onClick={() => onUnlinkTask(task.id)}>
                        <X size={14} />
                      </IconButton>
                      <IconButton label={`Delete ${task.title}`} onClick={() => onDeleteTask(task.id)} danger>
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
                onChange={(inputEvent) => onTaskDraftChange(inputEvent.target.value)}
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
              <p className="text-sm font-bold text-[#636366]">Specific event sharing</p>
              <span className="rounded-full bg-[#f2f2f7] px-2 py-0.5 text-[11px] font-bold text-[#8e8e93]">
                Safe placeholder
              </span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                value={shareDraft}
                onChange={(inputEvent) => onShareDraftChange(inputEvent.target.value)}
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
              <p key={share.id} className="mt-2 truncate text-xs font-bold text-[#7c7c8a]">
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
            <span className="size-2.5 rounded-full" style={{ backgroundColor: calendar.color }} />
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
  onToggle,
  onDelete,
}: {
  tasks: TaskListItem[];
  onToggle: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}) {
  return (
    <section>
      <SectionTitle eyebrow="Tasks" title="Checklist" count={tasks.length} />
      <div className="space-y-3">
        {tasks.map((task) => (
          <article
            key={task.id}
            className="flex w-full items-center gap-3 rounded-[24px] border border-white/60 bg-white/70 p-4 text-left shadow-lg shadow-black/5 backdrop-blur-xl"
          >
            <button
              type="button"
              onClick={() => onToggle(task.id)}
              className={["grid size-8 place-items-center rounded-full", task.done ? "bg-[#34c759] text-white" : "bg-[#f2f2f7] text-transparent"].join(" ")}
              aria-label={`Toggle ${task.title}`}
            >
              <Check size={16} />
            </button>
            <span className="min-w-0 flex-1">
              <span className={["block truncate text-base font-semibold", task.done ? "line-through text-[#8e8e93]" : ""].join(" ")}>
                {task.title}
              </span>
              <span className="block truncate text-sm font-semibold text-[#8e8e93]">
                {task.eventTitle}
                {task.eventStatus === "cancelled" ? " · event cancelled" : ""}
              </span>
            </span>
            <IconButton label={`Delete ${task.title}`} onClick={() => onDelete(task.id)} danger>
              <Trash2 size={15} />
            </IconButton>
          </article>
        ))}
      </div>
    </section>
  );
}

function AlertsTab({ alerts }: { alerts: RescheduleReminder[] }) {
  return (
    <section>
      <SectionTitle eyebrow="Alerts" title="Reminders" count={alerts.length} />
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <EmptyState title="No reminders" body="Cancelled events can create reschedule reminders here." />
        ) : (
          alerts.map((alert) => <ReminderCard key={alert.id} reminder={alert} />)
        )}
      </div>
    </section>
  );
}

function StatsTab({
  stats,
  aiSuggestions,
  aiEnabled,
}: {
  stats: ReturnType<typeof computeStats>;
  aiSuggestions: string[];
  aiEnabled: boolean;
}) {
  return (
    <section className="space-y-4">
      <SectionTitle eyebrow="Free stats" title="Progress dashboard" count={stats.totalEvents} />
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Events" value={stats.totalEvents} />
        <Stat label="Done" value={stats.completedEvents} />
        <Stat label="Cancelled" value={stats.cancelledEvents} />
        <Stat label="Upcoming" value={stats.upcomingEvents} />
      </div>
      <div className="rounded-[28px] border border-white/60 bg-white/70 p-4 shadow-lg shadow-black/5 backdrop-blur-xl">
        <p className="text-sm font-bold text-[#8e8e93]">Task completion</p>
        <div className="mt-3 h-3 rounded-full bg-[#f2f2f7]">
          <div className="h-3 rounded-full bg-[#34c759]" style={{ width: `${stats.taskCompletionRate}%` }} />
        </div>
        <p className="mt-2 text-sm font-bold text-[#636366]">{stats.taskCompletionRate}% complete</p>
      </div>
      <div className="rounded-[28px] border border-white/60 bg-white/70 p-4 shadow-lg shadow-black/5 backdrop-blur-xl">
        <p className="text-sm font-bold text-[#8e8e93]">Patterns</p>
        <p className="mt-2 text-sm font-semibold">Most used tag: {stats.mostUsedCategory}</p>
        <p className="mt-1 text-sm font-semibold">Most active day: {stats.mostActiveDay}</p>
        <p className="mt-3 text-sm font-semibold text-[#636366]">{stats.monthlySummary}</p>
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
              <p key={suggestion} className="rounded-2xl bg-[#f7eaff] px-3 py-2 text-sm font-semibold text-[#66308a]">
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
  memberDraft,
  setMemberDraft,
  onAddMember,
  settings,
  setSettings,
  notificationPermission,
  onNotificationChange,
  onAiChange,
  onSaveSettings,
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
  onUpdateCalendar: (calendarId: string, updates: { name?: string; color?: string }) => void;
  onAskDeleteCalendar: (calendar: AppCalendar) => void;
  memberDraft: { calendarId: string; email: string; role: "editor" | "viewer" };
  setMemberDraft: (draft: { calendarId: string; email: string; role: "editor" | "viewer" }) => void;
  onAddMember: (event: FormEvent<HTMLFormElement>) => void;
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  notificationPermission: string;
  onNotificationChange: (key: keyof AppSettings["notifications"], value: boolean | string) => void;
  onAiChange: (key: keyof AiSettings, value: boolean) => void;
  onSaveSettings: () => void;
  onOpenDeleteAccount: () => void;
}) {
  const selectedCalendar = calendars.find((calendar) => calendar.id === memberDraft.calendarId);
  const sharedCalendarUsed = calendars.some(
    (calendar) => calendar.shared && calendar.id !== memberDraft.calendarId,
  );
  const memberInviteDisabled = !selectedCalendar || (!selectedCalendar.shared && sharedCalendarUsed);
  const sharedCalendars = calendars.filter((calendar) => calendar.shared);

  return (
    <section className="space-y-4">
      <SectionTitle eyebrow="Settings" title="Account workspace" count={calendars.length} />
      {workspaceLoading && <p className="rounded-2xl bg-white/70 px-4 py-3 text-sm font-bold text-[#007aff]">Loading account data...</p>}
      {workspaceMessage && <p className="rounded-2xl bg-white/70 px-4 py-3 text-sm font-bold text-[#636366]">{workspaceMessage}</p>}

      <SettingsCard title="Profile" icon={<Users size={18} />}>
        <p className="text-sm font-semibold text-[#636366]">Signed in as {session?.user.email}</p>
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
          placeholder="Jessy"
        />
        <p className="mt-2 text-xs font-bold text-[#8e8e93]">
          This is your default name. You can use different display names inside shared calendars.
        </p>
        {sharedCalendars.length > 0 && (
          <div className="mt-3 space-y-2">
            {sharedCalendars.map((calendar) => (
            <label key={calendar.id} className="block">
              <span className="text-xs font-black text-[#8e8e93]">
                {calendar.name} display name
              </span>
              <input
                value={settings.profile.calendarDisplayNames[calendar.id] ?? ""}
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
                placeholder={settings.profile.accountName || "Yasmin, Jessy B., etc."}
              />
            </label>
            ))}
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Theme" icon={<Palette size={18} />}>
        <select
          value={settings.theme}
          onChange={(event) => setSettings({ ...settings, theme: event.target.value as AppSettings["theme"] })}
          className="input-shell mt-3 w-full"
        >
          <option value="system">System theme</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        <p className="mt-2 text-xs font-bold text-[#8e8e93]">
          Theme is part of the profile save flow. Use Save Settings when you are happy with it.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={onSaveSettings} className="h-11 rounded-full bg-[#007aff] text-sm font-bold text-white shadow-lg shadow-[#007aff]/25">
            Save settings
          </button>
          <button onClick={() => setSettings(defaultSettings)} className="h-11 rounded-full bg-white/75 text-sm font-bold text-[#636366] shadow-sm">
            Revert draft
          </button>
        </div>
        {settingsMessage && <p className="mt-2 text-sm font-bold text-[#34c759]">{settingsMessage}</p>}
        {settingsError && <p className="mt-2 text-sm font-bold text-[#ff3b30]">{settingsError}</p>}
      </SettingsCard>

      <SettingsCard title="Calendar Settings" icon={<CalendarDays size={18} />}>
        <form onSubmit={onCreateCalendar} className="grid grid-cols-[1fr_auto] gap-2">
          <input
            value={calendarDraft.name}
            onChange={(event) => setCalendarDraft({ ...calendarDraft, name: event.target.value })}
            className="input-shell"
            placeholder="New calendar name"
            disabled={calendars.length >= 3}
          />
          <button className="rounded-2xl bg-[#007aff] px-4 text-sm font-bold text-white disabled:opacity-50" disabled={calendars.length >= 3}>
            Add
          </button>
        </form>
        <p className="mt-2 text-xs font-bold text-[#8e8e93]">
          Free plan: up to 3 calendars total. Shared calendars also count toward your free calendar limit.
        </p>
        <div className="mt-4 space-y-3">
          {calendars.map((calendar) => (
            <CalendarManagementRow
              key={`${calendar.id}-${calendar.name}-${calendar.color}`}
              calendar={calendar}
              onUpdate={onUpdateCalendar}
              onAskDelete={onAskDeleteCalendar}
            />
          ))}
        </div>
        <form onSubmit={onAddMember} className="mt-3 space-y-2">
          <select
            value={memberDraft.calendarId}
            onChange={(event) => setMemberDraft({ ...memberDraft, calendarId: event.target.value })}
            className="input-shell w-full"
          >
            {calendars.map((calendar) => (
              <option key={calendar.id} value={calendar.id}>{calendar.name}</option>
            ))}
          </select>
          <input
            value={memberDraft.email}
            onChange={(event) => setMemberDraft({ ...memberDraft, email: event.target.value })}
            className="input-shell w-full"
            placeholder="member@example.com"
            disabled={memberInviteDisabled}
          />
          <select
            value={memberDraft.role}
            onChange={(event) =>
              setMemberDraft({ ...memberDraft, role: event.target.value as "editor" | "viewer" })
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
              Free plan includes one shared calendar. Remove sharing from another calendar before inviting here.
            </p>
          )}
        </form>
      </SettingsCard>

      <SettingsCard title="Notification Settings" icon={<BellRing size={18} />}>
        <p className="text-sm font-semibold text-[#636366]">Permission: {notificationPermission}</p>
        <div className="mt-3 grid gap-2">
          {([
            ["eventReminders", "Event reminders"],
            ["taskReminders", "Task reminders"],
            ["dailyAgenda", "Daily agenda"],
            ["rescheduleReminders", "Reschedule reminders"],
            ["birthdayReminders", "Birthday reminders"],
            ["desktopNotifications", "Desktop notifications"],
            ["mobileNotifications", "Mobile/PWA notifications"],
            ["quietHours", "Quiet hours"],
            ["sound", "Sound"],
            ["vibration", "Vibration"],
          ] as const).map(([key, label]) => (
            <Toggle
              key={key}
              checked={Boolean(settings.notifications[key])}
              label={label}
              onClick={() => onNotificationChange(key, !settings.notifications[key])}
            />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <input
            type="time"
            value={settings.notifications.quietStart}
            onChange={(event) => onNotificationChange("quietStart", event.target.value)}
            className="input-shell w-full"
            aria-label="Quiet hours start"
          />
          <input
            type="time"
            value={settings.notifications.quietEnd}
            onChange={(event) => onNotificationChange("quietEnd", event.target.value)}
            className="input-shell w-full"
            aria-label="Quiet hours end"
          />
        </div>
        <select
          value={settings.notifications.defaultTiming}
          onChange={(event) => onNotificationChange("defaultTiming", event.target.value)}
          className="input-shell mt-2 w-full"
        >
          <option value="At time of event">At time of event</option>
          <option value="5 minutes before">5 minutes before</option>
          <option value="15 minutes before">15 minutes before</option>
          <option value="30 minutes before">30 minutes before</option>
          <option value="1 hour before">1 hour before</option>
          <option value="1 day before">1 day before</option>
        </select>
        <p className="mt-3 text-xs font-bold text-[#8e8e93]">
          iPhone PWA notifications require iOS support, install-to-home-screen, permission, and a push backend. Full push delivery is not enabled yet.
        </p>
      </SettingsCard>

      <SettingsCard title="AI Lite and privacy" icon={<Shield size={18} />}>
        {([
          ["enabled", "Enable AI Lite"],
          ["scheduling", "Smart scheduling suggestions"],
          ["insights", "Productivity insights"],
          ["reschedule", "Smart reschedule suggestions"],
          ["weeklySummary", "Weekly summary text"],
          ["privateMode", "Private mode"],
        ] as const).map(([key, label]) => (
          <Toggle
            key={key}
            checked={settings.ai[key]}
            label={label}
            onClick={() => onAiChange(key, !settings.ai[key])}
          />
        ))}
        <p className="mt-3 text-xs font-bold text-[#8e8e93]">
          AI Lite is local and rule-based for now. Future OpenAI/Claude integrations would be opt-in. Your data is not sold.
        </p>
      </SettingsCard>

      <SettingsCard title="Sync & Export" icon={<Smartphone size={18} />}>
        <div className="grid gap-2">
          <PlaceholderRow title="Google Calendar sync" />
          <PlaceholderRow title="Outlook Calendar sync" />
          <PlaceholderRow title="Device calendar sync" />
          <PlaceholderRow title="Export data" />
        </div>
      </SettingsCard>

      <SettingsCard title="Pro Preview" icon={<Sparkles size={18} />}>
        <div className="grid grid-cols-2 gap-3">
          <PlanCard title="Free" body="3 calendars, 1 shared calendar, local AI Lite." />
          <PlanCard title="Pro preview" body="More calendars, deeper sync, payments coming soon." />
        </div>
      </SettingsCard>

      <SettingsCard title="Account" icon={<Shield size={18} />}>
        <PlaceholderRow title="Email managed by Supabase Auth" />
        <PlaceholderRow title="Password reset flow coming soon" />
      </SettingsCard>

      <SettingsCard title="Danger Zone" icon={<Trash2 size={18} />}>
        <p className="text-sm font-semibold leading-6 text-[#636366]">
          Destructive actions are separated from profile settings so they are harder to hit by accident.
        </p>
        <button
          onClick={onOpenDeleteAccount}
          className="mt-3 h-11 w-full rounded-full bg-[#ff3b30] text-sm font-bold text-white shadow-lg shadow-[#ff3b30]/20"
        >
          Delete account
        </button>
      </SettingsCard>

      <SettingsCard title="App, feedback, and legal" icon={<Sparkles size={18} />}>
        <div className="grid grid-cols-2 gap-2">
          <SettingsLink href="/get-app" label="Get App" />
          <SettingsLink href="/help" label="Help" />
          <SettingsLink href="/contact" label="Contact" />
          <SettingsLink href="/about" label="About" />
          <SettingsLink href="/privacy" label="Privacy" />
          <SettingsLink href="/terms" label="Terms" />
          <SettingsLink href="/cookies" label="Cookies" />
        </div>
      </SettingsCard>
    </section>
  );
}

function CalendarManagementRow({
  calendar,
  onUpdate,
  onAskDelete,
}: {
  calendar: AppCalendar;
  onUpdate: (calendarId: string, updates: { name?: string; color?: string }) => void;
  onAskDelete: (calendar: AppCalendar) => void;
}) {
  const [name, setName] = useState(calendar.name);
  const [color, setColor] = useState(calendar.color);

  const canDelete = calendar.role === "owner";
  const canEdit = calendar.role === "owner";

  return (
    <article className="rounded-[24px] bg-white/70 p-3 shadow-lg shadow-black/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full" style={{ backgroundColor: calendar.color }} />
            <p className="truncate text-sm font-black">{calendar.name}</p>
          </div>
          <p className="mt-1 text-xs font-bold text-[#8e8e93]">
            {calendar.shared ? "Shared calendar" : "Private calendar"} · Role: {calendar.role}
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
          You can view this shared calendar. Leaving shared calendars is prepared for a backend follow-up.
        </div>
      )}

      {calendar.members.length > 0 && (
        <div className="mt-3 space-y-1">
          {calendar.members.slice(0, 3).map((member) => (
            <p key={member.id} className="text-xs font-bold text-[#8e8e93]">
              {member.displayName || member.email} · {member.role} · {member.status}
            </p>
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
}) {
  const writableCalendars = calendars.filter((calendar) => calendar.role !== "viewer");

  return (
    <ModalShell>
      <form onSubmit={kind === "event" ? onSubmit : onSubmitTask} className="w-full max-w-md rounded-[32px] border border-white/70 bg-white/88 p-4 shadow-2xl shadow-black/20 backdrop-blur-2xl">
        <ModalHeader title={editing ? "Edit event" : "Create"} onClose={onClose} />
        {!editing && (
          <div className="mb-4 grid grid-cols-2 rounded-full bg-[#f2f2f7] p-1 text-sm font-bold">
            {(["event", "task"] as ComposerKind[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setKind(item)}
                className={[
                  "h-9 rounded-full capitalize transition",
                  kind === item ? "bg-white text-[#007aff] shadow-sm" : "text-[#7c7c8a]",
                ].join(" ")}
              >
                {item}
              </button>
            ))}
          </div>
        )}
        {kind === "task" && !editing ? (
          <div className="space-y-3">
            <input
              value={taskDraft.title}
              onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })}
              className="input-shell w-full text-base"
              placeholder="Task title"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={taskDraft.reminderDate}
                onChange={(event) => setTaskDraft({ ...taskDraft, reminderDate: event.target.value })}
                className="input-shell"
              />
              <AppleTimePicker
                value={taskDraft.reminderTime}
                onChange={(time) => setTaskDraft({ ...taskDraft, reminderTime: time })}
              />
            </div>
            <select
              value={taskDraft.eventId}
              onChange={(event) => setTaskDraft({ ...taskDraft, eventId: event.target.value })}
              className="input-shell w-full"
            >
              <option value="none">No event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  Bind to: {event.title}
                </option>
              ))}
            </select>
            <button className="mt-4 h-12 w-full rounded-full bg-[#007aff] text-base font-bold text-white shadow-lg shadow-[#007aff]/25 transition active:scale-95">
              Create task
            </button>
          </div>
        ) : (
        <>
          <div className="space-y-3">
          <input value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} className="input-shell text-base" placeholder="Event title" required />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={draft.date} onChange={(event) => onChange({ ...draft, date: event.target.value })} className="input-shell" />
            <AppleTimePicker
              value={draft.time}
              disabled={draft.allDay}
              onChange={(time) => onChange({ ...draft, time })}
            />
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <select value={draft.category} onChange={(event) => onChange({ ...draft, category: event.target.value })} className="input-shell">
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>{tag.label}</option>
              ))}
            </select>
            <button type="button" className="grid size-12 place-items-center rounded-2xl bg-[#f2f2f7] text-[#007aff]" onClick={onAddTag} aria-label="Add tag">
              <Palette size={19} />
            </button>
          </div>
          <select
            value={draft.calendarId ?? "personal"}
            onChange={(event) => onChange({ ...draft, calendarId: event.target.value })}
            className="input-shell capitalize"
          >
            {writableCalendars.map((calendar) => (
              <option key={calendar.id} value={calendar.id}>
                {calendar.name}{calendar.shared ? " (shared)" : ""}
              </option>
            ))}
          </select>
          <p className="text-xs font-bold text-[#8e8e93]">
            Move to calendar: viewers cannot move shared events. Linked tasks and reminders stay attached.
          </p>
          <select value={draft.recurrence} onChange={(event) => onChange({ ...draft, recurrence: event.target.value as Recurrence })} className="input-shell capitalize">
            {recurrences.map((recurrence) => <option key={recurrence} value={recurrence}>{recurrence}</option>)}
          </select>
          <input value={draft.location} onChange={(event) => onChange({ ...draft, location: event.target.value })} className="input-shell" placeholder="Location" />
          <textarea value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} className="min-h-20 w-full resize-none rounded-2xl bg-[#f2f2f7] px-4 py-3 text-sm font-semibold outline-none" placeholder="Notes" />
          <div className="grid grid-cols-2 gap-3">
            <Toggle checked={draft.allDay} label="All day" onClick={() => onChange({ ...draft, allDay: !draft.allDay })} />
            <Toggle checked={draft.pinned} label="Pinned" onClick={() => onChange({ ...draft, pinned: !draft.pinned })} />
          </div>
          <div className="rounded-2xl bg-[#f2f2f7] p-3">
            <Toggle
              checked={reminderDraft.enabled}
              label="Reminder"
              onClick={() => setReminderDraft({ ...reminderDraft, enabled: !reminderDraft.enabled })}
            />
            {reminderDraft.enabled && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={reminderDraft.date}
                  onChange={(event) => setReminderDraft({ ...reminderDraft, date: event.target.value })}
                  className="input-shell bg-white/70"
                />
                <AppleTimePicker
                  value={reminderDraft.time}
                  onChange={(time) => setReminderDraft({ ...reminderDraft, time })}
                />
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
          <button className="mt-4 h-12 w-full rounded-full bg-[#007aff] text-base font-bold text-white shadow-lg shadow-[#007aff]/25 transition active:scale-95">
            {editing ? "Save changes" : "Create event"}
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
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-[32px] border border-white/70 bg-white/90 p-4 shadow-2xl shadow-black/20 backdrop-blur-2xl">
        <ModalHeader title="Custom tag" onClose={onClose} />
        <div className="space-y-3">
          <input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} className="input-shell" placeholder="Tag name" required />
          <input value={draft.icon} onChange={(event) => setDraft({ ...draft, icon: event.target.value })} className="input-shell" placeholder="Icon name" />
          <div className="grid grid-cols-6 gap-2">
            {colorGrid.map((color) => (
              <button
                key={color}
                type="button"
                className="size-10 rounded-full ring-2 ring-white transition active:scale-95"
                style={{ background: color, outline: draft.color === color ? "3px solid #1d1d1f" : "none" }}
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
  const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
  const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

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

function CancelEventModal({
  event,
  reason,
  onReasonChange,
  onClose,
  onConfirm,
}: {
  event: CalendarEvent;
  reason: string;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell>
      <div className="w-full max-w-md rounded-[32px] border border-white/70 bg-white/90 p-4 shadow-2xl shadow-black/20 backdrop-blur-2xl">
        <ModalHeader title={event.title} eyebrow="Cancel event" onClose={onClose} />
        <p className="text-sm font-semibold leading-6 text-[#636366]">This keeps the event in your calendar as cancelled, including the reason and cancellation time.</p>
        <textarea value={reason} onChange={(event) => onReasonChange(event.target.value)} className="mt-4 min-h-28 w-full resize-none rounded-2xl bg-[#f2f2f7] px-4 py-3 text-sm font-semibold outline-none" placeholder="Optional cancellation reason" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" className="h-12 rounded-full bg-[#f2f2f7] text-base font-bold" onClick={onClose}>Keep event</button>
          <button type="button" className="h-12 rounded-full bg-[#ff3b30] text-base font-bold text-white shadow-lg shadow-[#ff3b30]/25" onClick={onConfirm}>Cancel event</button>
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
        <ModalHeader title="Create follow-up task?" eyebrow="Reschedule reminder" onClose={onClose} />
        <p className="rounded-2xl bg-[#fff7df] px-4 py-3 text-sm font-semibold text-[#7a5200]">
          Do you want to create a reminder to reschedule this event?
          <span className="mt-1 block text-[#1d1d1f]">Reschedule: {event.title}</span>
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <input type="date" value={draft.date} onChange={(event) => onChange({ ...draft, date: event.target.value })} className="input-shell" />
          <input type="time" value={draft.time} onChange={(event) => onChange({ ...draft, time: event.target.value })} className="input-shell" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" className="h-12 rounded-full bg-[#f2f2f7] text-base font-bold" onClick={onClose}>Not now</button>
          <button type="button" className="h-12 rounded-full bg-[#007aff] text-base font-bold text-white shadow-lg shadow-[#007aff]/25" onClick={onCreate}>Create reminder</button>
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
          <button type="button" className="h-12 rounded-full bg-[#f2f2f7] text-base font-bold" onClick={onClose}>
            Keep it
          </button>
          <button
            type="button"
            className={[
              "h-12 rounded-full text-base font-bold text-white shadow-lg",
              danger ? "bg-[#ff3b30] shadow-[#ff3b30]/25" : "bg-[#007aff] shadow-[#007aff]/25",
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
        <ModalHeader title="Are you sure you want to delete your account?" eyebrow="Danger Zone" onClose={onClose} />
        <p className="text-sm font-semibold leading-6 text-[#636366]">
          This is intentionally blocked until Supabase Auth admin deletion is configured. Type DELETE to test the confirmation flow.
        </p>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="input-shell mt-4 w-full"
          placeholder="Type DELETE"
        />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" className="h-12 rounded-full bg-[#f2f2f7] text-base font-bold" onClick={onClose}>
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
  tasks: Array<{ id: string; title: string; done: boolean; eventTitle: string }>;
  alerts: RescheduleReminder[];
}) {
  return (
    <>
      <section className="rounded-[36px] border border-white/55 bg-white/58 p-6 shadow-2xl shadow-[#6d5dfc]/10 backdrop-blur-3xl">
        <p className="text-sm font-bold text-[#8e8e93]">Desktop overview</p>
        <h2 className="mt-1 text-3xl font-semibold">{formatLongDate(selectedDate)}</h2>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat label="Events" value={events.length} />
          <Stat label="Tasks" value={tasks.filter((task) => !task.done).length} />
          <Stat label="Alerts" value={alerts.length + reminders.length} />
        </div>
      </section>
      <section className="overflow-y-auto rounded-[36px] border border-white/55 bg-white/58 p-6 pb-10 shadow-2xl shadow-[#6d5dfc]/10 backdrop-blur-3xl">
        <SectionTitle eyebrow="Planner" title="Today at a glance" count={events.length} />
        <div className="grid grid-cols-2 gap-4">
          {events.map((event) => (
            <article key={event.id} className="rounded-[24px] bg-white/70 p-4 shadow-lg shadow-black/5">
              <h3 className="text-base font-semibold">{event.title}</h3>
              <p className="mt-1 text-sm font-semibold text-[#8e8e93]">{event.time} · {event.location}</p>
              {event.tasks.filter((task) => !task.done).length > 0 && (
                <div className="mt-3 space-y-1">
                  {event.tasks
                    .filter((task) => !task.done)
                    .map((task) => (
                      <p key={task.id} className="text-sm font-semibold text-[#636366]">
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
}: {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
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
            className={["flex h-14 flex-col items-center justify-center gap-1 rounded-2xl transition active:scale-95", activeTab === item.id ? "text-[#007aff]" : "text-[#8e8e93]"].join(" ")}
          >
            <item.icon size={22} strokeWidth={activeTab === item.id ? 2.5 : 2.1} />
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
          <p className="text-sm font-semibold text-[#7c7c8a]">{reminder.date} at {reminder.time}</p>
        </div>
      </div>
    </article>
  );
}

function SectionTitle({ eyebrow, title, count }: { eyebrow: string; title: string; count: number }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <p className="text-sm font-bold text-[#8e8e93]">{eyebrow}</p>
        <h2 className="text-2xl font-semibold tracking-normal">{title}</h2>
      </div>
      <span className="rounded-full bg-white/70 px-3 py-1 text-sm font-bold text-[#007aff] shadow-sm">{count}</span>
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

function IconButton({ children, label, onClick, danger }: { children: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button className={["grid size-8 place-items-center rounded-full bg-white/75 transition active:scale-95", danger ? "text-[#ff3b30]" : "text-[#007aff]"].join(" ")} onClick={onClick} aria-label={label}>
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[24px] bg-white/70 p-4 text-center shadow-lg shadow-black/5">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm font-bold text-[#8e8e93]">{label}</p>
    </div>
  );
}

function SettingsCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-[28px] border border-white/60 bg-white/70 p-4 shadow-lg shadow-black/5 backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2 text-[#007aff]">
        {icon}
        <h3 className="text-base font-bold text-[#1d1d1f]">{title}</h3>
      </div>
      {children}
    </article>
  );
}

function PlaceholderRow({ title, danger }: { title: string; danger?: boolean }) {
  return (
    <div className="mt-2 flex items-center justify-between rounded-2xl bg-[#f2f2f7] px-3 py-2 text-sm font-bold">
      <span className={danger ? "text-[#ff3b30]" : "text-[#636366]"}>{title}</span>
      <span className="rounded-full bg-white px-2 py-1 text-[11px] text-[#8e8e93]">Coming soon</span>
    </div>
  );
}

function PlanCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-white/80 p-3 shadow-sm">
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs font-semibold text-[#7c7c8a]">{body}</p>
    </div>
  );
}

function SettingsLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl bg-white/80 px-3 py-2 text-center text-sm font-bold text-[#007aff] shadow-sm"
    >
      {label}
    </Link>
  );
}

function ModalShell({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 px-3 pb-3 backdrop-blur-sm">{children}</div>;
}

function ModalHeader({ title, eyebrow, onClose }: { title: string; eyebrow?: string; onClose: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        {eyebrow && <p className="text-sm font-bold text-[#8e8e93]">{eyebrow}</p>}
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <button type="button" className="grid size-9 place-items-center rounded-full bg-[#f2f2f7] text-[#636366]" onClick={onClose} aria-label="Close">
        <X size={19} />
      </button>
    </div>
  );
}

function Toggle({ checked, label, onClick }: { checked: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-12 items-center justify-between rounded-2xl bg-[#f2f2f7] px-3 text-sm font-bold">
      {label}
      <span className={["flex h-7 w-12 items-center rounded-full p-0.5 transition", checked ? "bg-[#34c759]" : "bg-[#c7c7cc]"].join(" ")}>
        <span className={["size-6 rounded-full bg-white shadow-sm transition", checked ? "translate-x-5" : "translate-x-0"].join(" ")} />
      </span>
    </button>
  );
}

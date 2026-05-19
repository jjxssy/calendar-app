"use client";

import {
  Bell,
  CalendarDays,
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
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AppSession,
  clearSession,
  readSession,
  sessionStorageKey,
} from "@/lib/api";
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

type AppTab = "calendar" | "tasks" | "alerts";
type ComposerKind = "event" | "task";

type EventDraft = Pick<
  CalendarEvent,
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
  eventId: string;
  eventTitle: string;
};

type TaskDraft = {
  title: string;
  reminderDate: string;
  reminderTime: string;
  eventId: string;
};

type CalendarData = {
  tags: CategoryStyle[];
  events: CalendarEvent[];
  standaloneTasks: StandaloneTask[];
  eventReminders: RescheduleReminder[];
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
    events: createInitialEvents(today),
    standaloneTasks: [],
    eventReminders: [],
  };

  if (!session || typeof window === "undefined") return fallback;

  const raw = localStorage.getItem(sessionStorageKey(session));
  if (!raw) return fallback;

  try {
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function emptyDraft(date: Date, category: string): EventDraft {
  return {
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

export default function Home() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const firedAlerts = useRef<Set<string>>(new Set());
  const session = useMemo(
    () => (typeof window !== "undefined" ? readSession() : null),
    [],
  );
  const isAuthed = Boolean(session);
  const initialData = useMemo(() => readCalendarData(session, today), [session, today]);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState<CalendarView>("month");
  const [activeTab, setActiveTab] = useState<AppTab>("calendar");
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<CategoryStyle[]>(() => initialData.tags);
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [events, setEvents] = useState(() => initialData.events);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EventDraft>(() => emptyDraft(today, "work"));
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

  const selectedKey = toDateKey(selectedDate);
  const monthDays = useMemo(() => getMonthDays(visibleMonth), [visibleMonth]);
  const tagMap = useMemo(
    () => Object.fromEntries(tags.map((tag) => [tag.id, tag])),
    [tags],
  );

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return events
      .filter((event) => {
        const tag = tagMap[event.category];
        const matchesCategory =
          activeCategory === "all" || event.category === activeCategory;
        const matchesQuery =
          !normalizedQuery ||
          [event.title, event.location, event.notes, tag?.label]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);

        return matchesCategory && matchesQuery && event.status !== "archived";
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.time.localeCompare(b.time));
  }, [activeCategory, events, query, tagMap]);

  const selectedEvents = filteredEvents.filter((event) => event.date === selectedKey);
  const selectedReminders = events
    .flatMap((event) => event.rescheduleReminders)
    .filter((reminder) => reminder.date === selectedKey && !reminder.done)
    .sort((a, b) => a.time.localeCompare(b.time));
  const weekDays = getWeekDays(selectedDate);
  const taskItems = useMemo(
    () =>
      events
        .flatMap((event) =>
          event.tasks.map((task) => ({
            ...task,
            eventId: event.id,
            eventTitle: event.title,
          })),
        )
        .concat(standaloneTasks),
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
              eventId: task.eventId,
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
    () => standaloneTasks.filter((task) => !task.done && task.eventId === "none"),
    [standaloneTasks],
  );

  useEffect(() => {
    if (!isAuthed) {
      router.replace("/login");
    }
  }, [isAuthed, router]);

  useEffect(() => {
    if (!session) return;

    localStorage.setItem(
      sessionStorageKey(session),
      JSON.stringify({ tags, events, standaloneTasks, eventReminders }),
    );
  }, [eventReminders, events, session, standaloneTasks, tags]);

  useEffect(() => {
    if (!isAuthed) return;

    const checkAlerts = () => {
      const now = new Date();
      alertItems.forEach((item) => {
        const due = new Date(`${item.date}T${item.time}`);
        if (due <= now && !firedAlerts.current.has(item.id)) {
          firedAlerts.current.add(item.id);
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Luma Calendar", { body: item.title });
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

  if (!isAuthed) {
    return null;
  }

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
    setDraft({ ...emptyDraft(selectedDate, tags[0]?.id ?? "work"), time: currentTimeValue(now) });
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

  function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = taskDraft.title.trim();
    if (!title) return;

    if (taskDraft.eventId !== "none") {
      setEvents((current) =>
        current.map((calendarEvent) =>
          calendarEvent.id === taskDraft.eventId
            ? {
                ...calendarEvent,
                tasks: [
                  ...calendarEvent.tasks,
                  { id: createId(), title, done: false },
                ],
              }
            : calendarEvent,
        ),
      );
    } else {
      setStandaloneTasks((current) => [
        {
          id: createId(),
          title,
          done: false,
          reminderDate: taskDraft.reminderDate,
          reminderTime: taskDraft.reminderTime,
          eventId: "none",
          eventTitle: "Standalone task",
        },
        ...current,
      ]);
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

  function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) return;

    setEvents((current) => {
      const previous = current.find((item) => item.id === editingId);
      const boundTasks = standaloneTasks
        .filter((task) => selectedTaskIds.includes(task.id))
        .map((task) => ({ id: task.id, title: task.title, done: task.done }));
      const nextEvent: CalendarEvent = {
        id: editingId ?? createId(),
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
        cancellationReason: previous?.cancellationReason,
        cancelledAt: previous?.cancelledAt,
        rescheduleReminders: previous?.rescheduleReminders ?? [],
        tasks: [
          ...(previous?.tasks ?? [{ id: createId(), title: "Prepare details", done: false }]),
          ...boundTasks,
        ],
      };

      return editingId
        ? current.map((item) => (item.id === editingId ? nextEvent : item))
        : [nextEvent, ...current];
    });

    if (selectedTaskIds.length > 0) {
      setStandaloneTasks((current) =>
        current.filter((task) => !selectedTaskIds.includes(task.id)),
      );
    }

    if (eventReminderDraft.enabled) {
      setEventReminders((current) => [
        {
          id: createId(),
          eventId: editingId ?? "new-event",
          title: `Event reminder: ${title}`,
          date: eventReminderDraft.date,
          time: eventReminderDraft.time,
          done: false,
        },
        ...current,
      ]);
      requestNotificationPermission();
    }

    const nextDate = fromDateKey(draft.date);
    setSelectedDate(nextDate);
    setVisibleMonth(startOfMonth(nextDate));
    setComposerOpen(false);
    setEditingId(null);
    setSelectedTaskIds([]);
  }

  function deleteEvent(id: string) {
    setEvents((current) => current.filter((event) => event.id !== id));
  }

  function confirmCancelEvent() {
    if (!cancelTarget) return;
    const cancelledEvent = {
      ...cancelTarget,
      status: "cancelled" as const,
      cancellationReason: cancellationReason.trim() || undefined,
      cancelledAt: new Date().toISOString(),
    };

    setEvents((current) =>
      current.map((event) => (event.id === cancelTarget.id ? cancelledEvent : event)),
    );
    setCancelTarget(null);
    setCancellationReason("");
    setRescheduleTarget(cancelledEvent);
    setRescheduleDraft({
      date: toDateKey(addDays(fromDateKey(cancelTarget.date), 1)),
      time: "09:00",
    });
  }

  function undoCancelEvent(id: string) {
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
  }

  function createRescheduleReminder() {
    if (!rescheduleTarget) return;
    const reminder: RescheduleReminder = {
      id: createId(),
      eventId: rescheduleTarget.id,
      title: `Reschedule: ${rescheduleTarget.title}`,
      date: rescheduleDraft.date,
      time: rescheduleDraft.time,
      done: false,
    };

    setEvents((current) =>
      current.map((event) =>
        event.id === rescheduleTarget.id
          ? {
              ...event,
              rescheduleReminders: [...event.rescheduleReminders, reminder],
              tasks: [...event.tasks, { id: reminder.id, title: reminder.title, done: false }],
            }
          : event,
      ),
    );
    selectDate(fromDateKey(rescheduleDraft.date));
    setActiveTab("alerts");
    setRescheduleTarget(null);
  }

  function createTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = tagDraft.label.trim();
    if (!label) return;

    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-") || createId();
    const newTag: CategoryStyle = {
      id,
      label,
      icon: tagDraft.icon.trim() || "tag",
      color: tagDraft.color,
      tint: tintFromColor(tagDraft.color),
    };

    setTags((current) => [...current, newTag]);
    setDraft((current) => ({ ...current, category: id }));
    setActiveCategory(id);
    setTagDraft({ label: "", icon: "tag", color: "#007aff" });
    setTagModalOpen(false);
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
              clearSession();
              router.replace("/login");
            }}
          />
          <section className="min-h-0 flex-1 scroll-pb-40 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+176px)] pt-5 lg:pb-10">
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
                />
              </>
            )}
            {activeTab === "tasks" && (
              <TasksTab
                tasks={taskItems}
                onToggle={(taskId) =>
                  setEvents((current) =>
                    current.map((event) => ({
                      ...event,
                      tasks: event.tasks.map((task) =>
                        task.id === taskId ? { ...task, done: !task.done } : task,
                      ),
                    })),
                  )
                }
              />
            )}
            {activeTab === "alerts" && <AlertsTab alerts={alertItems} />}
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
        <div>
          <p className="text-sm font-semibold text-[#7c7c8a]">{formatLongDate(today)}</p>
          <h1 className="text-3xl font-semibold tracking-normal">Luma Calendar</h1>
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
}: {
  selectedDate: Date;
  events: CalendarEvent[];
  reminders: RescheduleReminder[];
  tagFor: (event: CalendarEvent) => CategoryStyle;
  onEdit: (event: CalendarEvent) => void;
  onCancel: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
  onUndoCancel: (id: string) => void;
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
}: {
  event: CalendarEvent;
  tag: CategoryStyle;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onUndoCancel: () => void;
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
                {event.recurrence === "none" ? "One-time" : event.recurrence} · {event.priority} priority
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
        </div>
      </div>
    </article>
  );
}

function TasksTab({
  tasks,
  onToggle,
}: {
  tasks: Array<{ id: string; title: string; done: boolean; eventTitle: string }>;
  onToggle: (taskId: string) => void;
}) {
  return (
    <section>
      <SectionTitle eyebrow="Tasks" title="Checklist" count={tasks.length} />
      <div className="space-y-3">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => onToggle(task.id)}
            className="flex w-full items-center gap-3 rounded-[24px] border border-white/60 bg-white/70 p-4 text-left shadow-lg shadow-black/5 backdrop-blur-xl"
          >
            <span className={["grid size-8 place-items-center rounded-full", task.done ? "bg-[#34c759] text-white" : "bg-[#f2f2f7] text-transparent"].join(" ")}>
              <Check size={16} />
            </span>
            <span className="min-w-0">
              <span className={["block truncate text-base font-semibold", task.done ? "line-through text-[#8e8e93]" : ""].join(" ")}>
                {task.title}
              </span>
              <span className="block truncate text-sm font-semibold text-[#8e8e93]">{task.eventTitle}</span>
            </span>
          </button>
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

function EventComposer({
  draft,
  editing,
  kind,
  setKind,
  tags,
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
      <section className="overflow-y-auto rounded-[36px] border border-white/55 bg-white/58 p-6 shadow-2xl shadow-[#6d5dfc]/10 backdrop-blur-3xl">
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
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-white/50 bg-white/58 px-5 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 backdrop-blur-2xl lg:absolute lg:rounded-b-[36px]">
      <div className="grid grid-cols-3 text-[11px] font-bold">
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

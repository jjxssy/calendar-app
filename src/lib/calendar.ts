export type CalendarView = "month" | "week" | "day";

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function sameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function toDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function fromDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

export function getWeekDays(anchor: Date) {
  const start = addDays(anchor, -anchor.getDay());
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function getMonthDays(anchor: Date) {
  const first = startOfMonth(anchor);
  const startOffset = first.getDay();
  const daysInMonth = new Date(
    anchor.getFullYear(),
    anchor.getMonth() + 1,
    0,
  ).getDate();
  const previousMonthDays = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    0,
  ).getDate();

  return Array.from({ length: 42 }, (_, index) => {
    const calendarDay = index - startOffset + 1;
    const date = new Date(anchor.getFullYear(), anchor.getMonth(), calendarDay);

    return {
      date,
      key: toDateKey(date),
      label:
        calendarDay < 1
          ? previousMonthDays + calendarDay
          : calendarDay > daysInMonth
            ? calendarDay - daysInMonth
            : calendarDay,
      currentMonth: calendarDay >= 1 && calendarDay <= daysInMonth,
    };
  });
}

export function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

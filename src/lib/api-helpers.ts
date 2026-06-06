import { cookies } from "next/headers";
import { headers } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function ok<T>(data: T, status = 200) {
  return Response.json(data, { status });
}

export function fail(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return Response.json({ error: "Something went wrong." }, { status: 500 });
}

export async function readBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    throw new ApiError("Request body must be valid JSON.");
  }
}

export function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

export function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

export function numberValue(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new ApiError(`${fieldName} must be a number.`);
  return number;
}

export function dateValue(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new ApiError(`${fieldName} must be a date string.`);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(`${fieldName} must be a valid date.`);
  return date;
}

async function upsertSupabaseUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: { name?: string; full_name?: string };
}) {
  if (!user.email) {
    throw new ApiError("Your account needs an email address.", 400);
  }

  return prisma.user.upsert({
    where: { id: user.id },
    update: {
      email: user.email,
    },
    create: {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name ?? user.user_metadata?.full_name,
    },
  });
}

export async function requireUser() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data, error } = await supabase.auth.getUser();

  if (!error && data.user) {
    return upsertSupabaseUser(data.user);
  }

  const authorization = (await headers()).get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (token) {
    const authClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
    const tokenUser = await authClient.auth.getUser(token);
    if (!tokenUser.error && tokenUser.data.user) {
      return upsertSupabaseUser(tokenUser.data.user);
    }
  }

  throw new ApiError("You must be signed in.", 401);
}

export async function ensureEvent(userId: string, eventId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user) throw new ApiError("You must be signed in.", 401);

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      OR: [
        { userId: user.id },
        { user: { email: user.email } },
        { calendar: { ownerId: user.id } },
        { calendar: { owner: { email: user.email } } },
        { calendar: { members: { some: { userId: user.id, status: "accepted" } } } },
        { calendar: { members: { some: { email: user.email, status: "accepted" } } } },
      ],
    },
    include: { calendar: { include: { members: true, owner: true } } },
  });

  if (!event) throw new ApiError("Event not found.", 404);
  return event;
}

export async function ensureEditableEvent(userId: string, eventId: string) {
  const event = await ensureEvent(userId, eventId);
  const member = event.calendar?.members.find((item) => item.userId === userId);
  const canEdit =
    event.userId === userId ||
    event.calendar?.ownerId === userId ||
    member?.role === "owner" ||
    member?.role === "editor";

  if (!canEdit) throw new ApiError("You do not have permission to edit this event.", 403);
  return event;
}

export async function ensureTask(userId: string, taskId: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!task) throw new ApiError("Task not found.", 404);
  return task;
}

export async function ensureCategory(userId: string, categoryId: string) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) throw new ApiError("Category not found.", 404);
  return category;
}

export async function ensureCalendar(userId: string, calendarId: string) {
  const calendar = await prisma.calendar.findFirst({
    where: {
      id: calendarId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId, status: "accepted" } } },
      ],
    },
  });
  if (!calendar) throw new ApiError("Calendar not found.", 404);
  return calendar;
}

export async function ensureWritableCalendar(userId: string, calendarId: string) {
  const calendar = await prisma.calendar.findFirst({
    where: {
      id: calendarId,
      OR: [
        { ownerId: userId },
        {
          members: {
            some: {
              userId,
              status: "accepted",
              role: { in: ["owner", "editor"] },
            },
          },
        },
      ],
    },
    include: { members: true },
  });
  if (!calendar) throw new ApiError("You cannot add or move events to this calendar.", 403);
  return calendar;
}

export async function ensureOwnedCalendar(userId: string, calendarId: string) {
  const calendar = await prisma.calendar.findFirst({
    where: { id: calendarId, ownerId: userId },
    include: { members: true },
  });
  if (!calendar) throw new ApiError("Only the calendar owner can do that.", 403);
  return calendar;
}

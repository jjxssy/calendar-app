import {
  ApiError,
  dateValue,
  ensureEvent,
  fail,
  ok,
  readBody,
  requireUser,
  stringValue,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const priorities = ["low", "normal", "high", "urgent"] as const;

function priorityValue(value: unknown) {
  if (value === undefined) return undefined;

  if (typeof value !== "string" || !priorities.includes(value as never)) {
    throw new ApiError("priority must be low, normal, high, or urgent.");
  }

  return value as (typeof priorities)[number];
}

function taskAccessWhere(user: { id: string; email: string }) {
  return {
    OR: [
      { userId: user.id },
      { user: { email: user.email } },
      { event: { userId: user.id } },
      { event: { user: { email: user.email } } },
      { event: { calendar: { ownerId: user.id } } },
      { event: { calendar: { owner: { email: user.email } } } },
      {
        event: {
          calendar: {
            members: {
              some: {
                OR: [{ userId: user.id }, { email: user.email }],
                status: "accepted" as const,
              },
            },
          },
        },
      },
    ],
  };
}

export async function GET() {
  try {
    const user = await requireUser();

    const tasks = await prisma.task.findMany({
      where: taskAccessWhere(user),
      include: {
        event: true,
        reminders: true,
      },
      orderBy: [
        { completed: "asc" },
        { dueDate: "asc" },
        { createdAt: "desc" },
      ],
    });

    return ok({ tasks });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readBody(request);

    const title = stringValue(body.title);
    const rawEventId = stringValue(body.eventId);
    const eventId = rawEventId && rawEventId !== "none" ? rawEventId : undefined;
    const dueDate = dateValue(body.dueDate, "dueDate");

    if (!title) throw new ApiError("title is required.");

    if (eventId) {
      await ensureEvent(user.id, eventId);
    }

    const task = await prisma.task.create({
      data: {
        userId: user.id,
        eventId,
        title,
        description: stringValue(body.description),
        completed: false,
        dueDate,
        priority: priorityValue(body.priority) ?? "normal",
      },
      include: {
        event: true,
        reminders: true,
      },
    });

    return ok({ task }, 201);
  } catch (error) {
    return fail(error);
  }
}

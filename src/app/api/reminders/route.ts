import {
  ApiError,
  booleanValue,
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

function reminderAccessWhere(user: { id: string; email: string }) {
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
      { task: { userId: user.id } },
      { task: { user: { email: user.email } } },
      { task: { event: { userId: user.id } } },
      { task: { event: { calendar: { ownerId: user.id } } } },
      {
        task: {
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
      },
    ],
  };
}

async function ensureTaskAccess(user: { id: string; email: string }, taskId: string) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
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
                  status: "accepted",
                },
              },
            },
          },
        },
      ],
    },
  });

  if (!task) throw new ApiError("Task not found.", 404);

  return task;
}

export async function GET() {
  try {
    const user = await requireUser();

    const reminders = await prisma.reminder.findMany({
      where: reminderAccessWhere(user),
      include: {
        event: true,
        task: true,
      },
      orderBy: [
        { completed: "asc" },
        { remindAt: "asc" },
      ],
    });

    return ok({ reminders });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readBody(request);

    const title = stringValue(body.title);
    const remindAt = dateValue(body.remindAt, "remindAt");
    const rawEventId = stringValue(body.eventId);
    const rawTaskId = stringValue(body.taskId);

    const eventId = rawEventId && rawEventId !== "none" ? rawEventId : undefined;
    const taskId = rawTaskId && rawTaskId !== "none" ? rawTaskId : undefined;

    if (!title) throw new ApiError("title is required.");
    if (!remindAt) throw new ApiError("remindAt is required.");
    if (remindAt.getTime() <= Date.now()) {
      throw new ApiError("Reminder time must be in the future.");
    }

    if (eventId) await ensureEvent(user.id, eventId);
    if (taskId) await ensureTaskAccess(user, taskId);

    const reminder = await prisma.reminder.create({
      data: {
        userId: user.id,
        eventId,
        taskId,
        title,
        remindAt,
        completed: booleanValue(body.completed) ?? false,
      },
      include: {
        event: true,
        task: true,
      },
    });

    return ok({ reminder }, 201);
  } catch (error) {
    return fail(error);
  }
}

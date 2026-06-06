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

const priorities = ["low", "normal", "high", "urgent"] as const;

function priorityValue(value: unknown) {
  if (value === undefined) return undefined;

  if (typeof value !== "string" || !priorities.includes(value as never)) {
    throw new ApiError("priority must be low, normal, high, or urgent.");
  }

  return value as (typeof priorities)[number];
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await readBody(request);

    const rawEventId = body.eventId === null ? null : stringValue(body.eventId);
    const eventId = rawEventId === "none" ? null : rawEventId;

    await ensureTaskAccess(user, id);

    if (eventId) {
      await ensureEvent(user.id, eventId);
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        eventId,
        title: stringValue(body.title),
        description: stringValue(body.description),
        completed: booleanValue(body.completed),
        dueDate: dateValue(body.dueDate, "dueDate"),
        priority: priorityValue(body.priority),
      },
      include: {
        event: true,
        reminders: true,
      },
    });

    return ok({ task });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    await ensureTaskAccess(user, id);

    const task = await prisma.task.delete({ where: { id } });

    return ok({ task });
  } catch (error) {
    return fail(error);
  }
}
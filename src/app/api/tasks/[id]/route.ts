import { ApiError, booleanValue, dateValue, ensureEvent, ensureTask, fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const priorities = ["low", "normal", "high", "urgent"] as const;

function priorityValue(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !priorities.includes(value as never)) {
    throw new ApiError("priority must be low, normal, high, or urgent.");
  }
  return value as (typeof priorities)[number];
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await readBody(request);
    const eventId = body.eventId === null ? null : stringValue(body.eventId);

    await ensureTask(user.id, id);
    if (eventId) await ensureEvent(user.id, eventId);

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
      include: { event: true, reminders: true },
    });

    return ok({ task });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await ensureTask(user.id, id);

    const task = await prisma.task.delete({ where: { id } });
    return ok({ task });
  } catch (error) {
    return fail(error);
  }
}

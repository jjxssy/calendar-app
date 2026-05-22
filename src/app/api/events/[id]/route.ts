import { ApiError, booleanValue, dateValue, ensureCategory, ensureEvent, fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const priorities = ["low", "normal", "high", "urgent"] as const;
const statuses = ["scheduled", "completed", "cancelled", "archived"] as const;

function priorityValue(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !priorities.includes(value as never)) {
    throw new ApiError("priority must be low, normal, high, or urgent.");
  }
  return value as (typeof priorities)[number];
}

function statusValue(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !statuses.includes(value as never)) {
    throw new ApiError("status must be scheduled, completed, cancelled, or archived.");
  }
  return value as (typeof statuses)[number];
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await readBody(request);
    const categoryId = body.categoryId === null ? null : stringValue(body.categoryId);

    await ensureEvent(user.id, id);
    if (categoryId) await ensureCategory(user.id, categoryId);

    const event = await prisma.event.update({
      where: { id },
      data: {
        categoryId,
        title: stringValue(body.title),
        description: stringValue(body.description),
        startDate: dateValue(body.startDate, "startDate"),
        endDate: dateValue(body.endDate, "endDate"),
        allDay: booleanValue(body.allDay),
        color: stringValue(body.color),
        location: stringValue(body.location),
        url: stringValue(body.url),
        priority: priorityValue(body.priority),
        pinned: booleanValue(body.pinned),
        status: statusValue(body.status),
      },
      include: { category: true, tasks: true, reminders: true },
    });

    return ok({ event });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await ensureEvent(user.id, id);

    const event = await prisma.event.update({
      where: { id },
      data: { status: "archived", archivedAt: new Date() },
    });

    return ok({ event });
  } catch (error) {
    return fail(error);
  }
}

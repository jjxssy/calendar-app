import { ApiError, booleanValue, dateValue, ensureCategory, ensureEditableEvent, ensureWritableCalendar, fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
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
    const calendarId = body.calendarId === null ? null : stringValue(body.calendarId);

    const existing = await ensureEditableEvent(user.id, id);
    if (categoryId) await ensureCategory(user.id, categoryId);
    if (calendarId) await ensureWritableCalendar(user.id, calendarId);

    const event = await prisma.$transaction(async (tx) => {
      const updated = await tx.event.update({
        where: { id },
        data: {
          calendarId,
          categoryId,
          updatedById: user.id,
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
        include: { calendar: true, category: true, tasks: true, reminders: true, shares: true },
      });
      const moved = existing.calendarId !== updated.calendarId;
      if (moved) {
        const calendars = await tx.calendar.findMany({
          where: { id: { in: [existing.calendarId, updated.calendarId].filter(Boolean) as string[] } },
          select: { id: true, name: true },
        });
        const oldName =
          calendars.find((calendar) => calendar.id === existing.calendarId)?.name ?? "No calendar";
        const newName =
          calendars.find((calendar) => calendar.id === updated.calendarId)?.name ?? "No calendar";
        await tx.activityHistory.create({
          data: {
            calendarId: updated.calendarId,
            eventId: id,
            userId: user.id,
            action: "event.moved",
            details: `${user.name ?? user.email} moved event from ${oldName} to ${newName}.`,
          },
        });
      }

      await tx.activityHistory.create({
        data: {
          calendarId: updated.calendarId,
          eventId: id,
          userId: user.id,
          action: "event.updated",
          details: `Updated "${updated.title}"`,
        },
      });

      return updated;
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
    await ensureEditableEvent(user.id, id);

    const event = await prisma.$transaction(async (tx) => {
      const archived = await tx.event.update({
        where: { id },
        data: { status: "archived", archivedAt: new Date(), updatedById: user.id },
      });

      await tx.activityHistory.create({
        data: {
          calendarId: archived.calendarId,
          eventId: id,
          userId: user.id,
          action: "event.archived",
          details: `Archived "${archived.title}"`,
        },
      });

      return archived;
    });

    return ok({ event });
  } catch (error) {
    return fail(error);
  }
}

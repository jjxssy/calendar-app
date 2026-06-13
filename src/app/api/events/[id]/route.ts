import {
  ApiError,
  booleanValue,
  dateValue,
  ensureCategory,
  ensureEditableEvent,
  ensureWritableCalendar,
  fail,
  ok,
  readBody,
  requireUser,
  stringValue,
} from "@/lib/api-helpers";
import { withEventActor } from "@/lib/event-response";
import { prisma } from "@/lib/prisma";

const priorities = ["low", "normal", "high", "urgent"] as const;
const statuses = ["scheduled", "completed", "cancelled", "archived"] as const;
const recurrences = ["none", "daily", "weekly", "monthly", "yearly"] as const;

const sharedEventPreviewMarker =
  /\[\[arcgenda-shared-event:(viewer|editor):([^\]]+)\]\]/;

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
    throw new ApiError(
      "status must be scheduled, completed, cancelled, or archived.",
    );
  }

  return value as (typeof statuses)[number];
}

function recurrenceValue(value: unknown) {
  if (value === undefined) return undefined;

  if (typeof value !== "string" || !recurrences.includes(value as never)) {
    throw new ApiError(
      "recurrence must be none, daily, weekly, monthly, or yearly.",
    );
  }

  return value as (typeof recurrences)[number];
}

function descriptionWithShareMarker(
  description: string | null | undefined,
  role: "viewer" | "editor",
  shareId: string,
) {
  const cleanDescription = (description ?? "")
    .replace(/\n?\n?\[\[arcgenda-shared-event:(viewer|editor):[^\]]+\]\]/g, "")
    .trim();

  return `${cleanDescription}${cleanDescription ? "\n\n" : ""}[[arcgenda-shared-event:${role}:${shareId}]]`;
}

async function resolvePatchTarget(user: { id: string; email: string }, id: string) {
  const requestedEvent = await ensureEditableEvent(user.id, id);
  const previewMatch = requestedEvent.description?.match(sharedEventPreviewMarker);

  if (!previewMatch) {
    return {
      requestedEvent,
      targetEventId: id,
      previewEventId: null as string | null,
      sharedEditor: false,
    };
  }

  const shareId = previewMatch[2];

  const share = await prisma.eventShare.findFirst({
    where: {
      id: shareId,
      status: "accepted",
      role: "editor",
      OR: [{ userId: user.id }, { email: user.email }],
    },
    include: {
      event: {
        include: {
          calendar: {
            include: {
              members: {
                include: {
                  user: {
                    select: { id: true, name: true, email: true },
                  },
                },
              },
            },
          },
          category: true,
          tasks: true,
          reminders: true,
          shares: true,
        },
      },
    },
  });

  if (!share) {
    throw new ApiError("You only have view access to this shared event.", 403);
  }

  return {
    requestedEvent,
    targetEventId: share.eventId,
    previewEventId: id,
    originalEvent: share.event,
    sharedEditor: true,
  };
}

async function syncAcceptedSharedPreviews(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  originalEventId: string,
  updates: {
    title?: string;
    description?: string | null;
    startDate?: Date;
    endDate?: Date | null;
    allDay?: boolean;
    color?: string | null;
    location?: string | null;
    priority?: "low" | "normal" | "high" | "urgent";
    recurrence?: "none" | "daily" | "weekly" | "monthly" | "yearly";
    pinned?: boolean;
    status?: "scheduled" | "completed" | "cancelled" | "archived";
  },
  updatedById: string,
) {
  const acceptedShares = await tx.eventShare.findMany({
    where: {
      eventId: originalEventId,
      status: "accepted",
    },
    select: {
      id: true,
      role: true,
      userId: true,
      email: true,
    },
  });

  await Promise.all(
    acceptedShares.map((share) =>
      tx.event.updateMany({
        where: {
          userId: share.userId ?? undefined,
          description: {
            contains: `[[arcgenda-shared-event:${share.role === "editor" ? "editor" : "viewer"}:${share.id}]]`,
          },
        },
        data: {
          ...updates,
          updatedById,
          description: descriptionWithShareMarker(
  updates.description,
  share.role === "editor" ? "editor" : "viewer",
  share.id,
)
        },
      }),
    ),
  );
}

async function ensureOwnerDeleteAccess(userId: string, eventId: string) {
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      OR: [
        { userId },
        { calendar: { ownerId: userId } },
      ],
    },
    select: {
      id: true,
      title: true,
      userId: true,
      calendarId: true,
      description: true,
      calendar: { select: { ownerId: true } },
    },
  });

  if (!event) {
    throw new ApiError("Only the event owner can delete or cancel this event.", 403);
  }

  if (event.description?.match(sharedEventPreviewMarker)) {
    throw new ApiError("Shared previews cannot be deleted from the owner calendar.", 403);
  }

  return event;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await readBody(request);

    const target = await resolvePatchTarget(user, id);
    const sharedEditor = target.sharedEditor;

    const categoryId = sharedEditor
      ? undefined
      : body.categoryId === null
        ? null
        : stringValue(body.categoryId);

    const calendarId = sharedEditor
      ? undefined
      : body.calendarId === null
        ? null
        : stringValue(body.calendarId);

    if (categoryId) await ensureCategory(user.id, categoryId);
    if (calendarId) await ensureWritableCalendar(user.id, calendarId);

    const requestedStatus = statusValue(body.status);

    if (sharedEditor && requestedStatus && requestedStatus !== "scheduled") {
      throw new ApiError("Only the event owner can cancel, complete, archive, or delete this event.", 403);
    }

    const event = await prisma.$transaction(async (tx) => {
      const updateData = {
        ...(calendarId !== undefined ? { calendarId } : {}),
        ...(categoryId !== undefined ? { categoryId } : {}),
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
        recurrence: recurrenceValue(body.recurrence),
        ...(sharedEditor ? {} : { pinned: booleanValue(body.pinned) }),
        ...(sharedEditor ? {} : { status: requestedStatus }),
      };

      const updated = await tx.event.update({
        where: { id: target.targetEventId },
        data: updateData,
        include: {
          calendar: {
            include: {
              members: {
                include: {
                  user: {
                    select: { id: true, name: true, email: true },
                  },
                },
              },
            },
          },
          category: true,
          tasks: true,
          reminders: true,
          shares: true,
        },
      });

      await syncAcceptedSharedPreviews(
        tx,
        updated.id,
        {
          title: updated.title,
          description: updated.description,
          startDate: updated.startDate,
          endDate: updated.endDate,
          allDay: updated.allDay,
          color: updated.color,
          location: updated.location,
          priority: updated.priority,
          recurrence: updated.recurrence,
          pinned: updated.pinned,
          status: updated.status,
        },
        user.id,
      );

      await tx.activityHistory.create({
        data: {
          calendarId: updated.calendarId,
          eventId: updated.id,
          userId: user.id,
          action: sharedEditor ? "event.shared_editor_updated" : "event.updated",
          details: sharedEditor
            ? `${user.name ?? user.email} edited shared event "${updated.title}"`
            : `Updated "${updated.title}"`,
        },
      });

      return updated;
    });

    return ok({ event: await withEventActor(event) });
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

    await ensureOwnerDeleteAccess(user.id, id);

    const event = await prisma.$transaction(async (tx) => {
      const linkedTasks = await tx.task.findMany({
        where: { eventId: id },
        select: { id: true },
      });

      const linkedTaskIds = linkedTasks.map((task) => task.id);

      const archived = await tx.event.update({
        where: { id },
        data: {
          status: "archived",
          archivedAt: new Date(),
          updatedById: user.id,
        },
      });

      await syncAcceptedSharedPreviews(
        tx,
        archived.id,
        {
          title: archived.title,
          description: archived.description,
          startDate: archived.startDate,
          endDate: archived.endDate,
          allDay: archived.allDay,
          color: archived.color,
          location: archived.location,
          priority: archived.priority,
          recurrence: archived.recurrence,
          pinned: archived.pinned,
          status: archived.status,
        },
        user.id,
      );

      await tx.reminder.deleteMany({
        where: {
          OR: [
            { eventId: id },
            ...(linkedTaskIds.length > 0
              ? [{ taskId: { in: linkedTaskIds } }]
              : []),
          ],
        },
      });

      await tx.activityHistory.create({
        data: {
          calendarId: archived.calendarId,
          eventId: id,
          userId: user.id,
          action: "event.archived",
          details: `Archived "${archived.title}" and cleared its reminders`,
        },
      });

      return archived;
    });

    return ok({ event });
  } catch (error) {
    return fail(error);
  }
}
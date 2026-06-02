import { ApiError, booleanValue, dateValue, ensureEditableEvent, fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
import { withEventActor } from "@/lib/event-response";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await readBody(request);
    const event = await ensureEditableEvent(user.id, id);
    const reminderAt = dateValue(body.reminderAt, "reminderAt");
    const createRescheduleReminder = booleanValue(body.createRescheduleReminder) ?? false;
    const createRescheduleTask = booleanValue(body.createRescheduleTask) ?? false;
    const cancellationScope =
      stringValue(body.cancellationScope) === "series" ? "series" : "single";

    if ((createRescheduleReminder || createRescheduleTask) && !reminderAt) {
      throw new ApiError("reminderAt is required when creating a reschedule reminder or task.");
    }

    const result = await prisma.$transaction(async (tx) => {
      const cancelledEvent = await tx.event.update({
        where: { id },
        data: {
          status: "cancelled",
          cancellationReason: stringValue(body.cancellationReason),
          cancelledAt: new Date(),
          updatedById: user.id,
        },
        include: {
          calendar: { include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } } },
          category: true,
          tasks: true,
          reminders: true,
          shares: true,
        },
      });

      const title = `Reschedule: ${event.title}`;
      const task = createRescheduleTask
        ? await tx.task.create({
            data: {
              userId: user.id,
              eventId: id,
              title,
              dueDate: reminderAt,
            },
          })
        : null;

      const reminder = createRescheduleReminder
        ? await tx.reminder.create({
            data: {
              userId: user.id,
              eventId: id,
              taskId: task?.id,
              title,
              remindAt: reminderAt!,
            },
        })
        : null;

      await tx.activityHistory.create({
        data: {
          calendarId: cancelledEvent.calendarId,
          eventId: id,
          userId: user.id,
          action: "event.cancelled",
          details:
            stringValue(body.cancellationReason) ??
            `Cancelled ${cancellationScope === "series" ? "series" : "event"} "${event.title}"`,
        },
      });

      return { event: cancelledEvent, task, reminder };
    });

    return ok({ ...result, event: await withEventActor(result.event) });
  } catch (error) {
    return fail(error);
  }
}

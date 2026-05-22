import { ApiError, booleanValue, dateValue, ensureEvent, fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await readBody(request);
    const event = await ensureEvent(user.id, id);
    const reminderAt = dateValue(body.reminderAt, "reminderAt");
    const createRescheduleReminder = booleanValue(body.createRescheduleReminder) ?? false;
    const createRescheduleTask = booleanValue(body.createRescheduleTask) ?? false;

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
        },
        include: { category: true, tasks: true, reminders: true },
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

      return { event: cancelledEvent, task, reminder };
    });

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

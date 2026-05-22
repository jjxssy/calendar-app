import { ApiError, booleanValue, dateValue, ensureEvent, ensureTask, fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireUser();
    const reminders = await prisma.reminder.findMany({
      where: { userId: user.id },
      include: { event: true, task: true },
      orderBy: [{ completed: "asc" }, { remindAt: "asc" }],
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
    const eventId = stringValue(body.eventId);
    const taskId = stringValue(body.taskId);

    if (!title) throw new ApiError("title is required.");
    if (!remindAt) throw new ApiError("remindAt is required.");
    if (eventId) await ensureEvent(user.id, eventId);
    if (taskId) await ensureTask(user.id, taskId);

    const reminder = await prisma.reminder.create({
      data: {
        userId: user.id,
        eventId,
        taskId,
        title,
        remindAt,
        completed: booleanValue(body.completed) ?? false,
      },
      include: { event: true, task: true },
    });

    return ok({ reminder }, 201);
  } catch (error) {
    return fail(error);
  }
}

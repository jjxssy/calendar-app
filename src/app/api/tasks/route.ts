import { ApiError, dateValue, ensureEvent, fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const priorities = ["low", "normal", "high", "urgent"] as const;

function priorityValue(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !priorities.includes(value as never)) {
    throw new ApiError("priority must be low, normal, high, or urgent.");
  }
  return value as (typeof priorities)[number];
}

export async function GET() {
  try {
    const user = await requireUser();
    const tasks = await prisma.task.findMany({
      where: { userId: user.id },
      include: { event: true, reminders: true },
      orderBy: [{ completed: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
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
    const eventId = stringValue(body.eventId);

    if (!title) throw new ApiError("title is required.");
    if (eventId) await ensureEvent(user.id, eventId);
    const dueDate = dateValue(body.dueDate, "dueDate");
    if (dueDate && dueDate.getTime() <= Date.now()) {
      throw new ApiError("Task reminder time must be in the future.");
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
      include: { event: true, reminders: true },
    });

    return ok({ task }, 201);
  } catch (error) {
    return fail(error);
  }
}

import {
  ApiError,
  dateValue,
  fail,
  ok,
  readBody,
  requireUser,
  stringValue,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

async function ensureTaskWriteAccess(
  user: { id: string; email: string },
  taskId: string,
) {
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
                  role: { in: ["owner", "editor"] },
                },
              },
            },
          },
        },
        {
          event: {
            shares: {
              some: {
                OR: [{ userId: user.id }, { email: user.email }],
                status: "accepted",
                role: "editor",
              },
            },
          },
        },
      ],
    },
  });

  if (!task) {
    throw new ApiError("You do not have permission to edit this task.", 403);
  }

  return task;
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await readBody(request);

    await ensureTaskWriteAccess(user, id);

    const remindAt = dateValue(body.remindAt, "remindAt");
    const title = stringValue(body.title) || "Task reminder";

    if (!remindAt) throw new ApiError("remindAt is required.");
    if (remindAt.getTime() <= Date.now()) {
      throw new ApiError("Reminder time must be in the future.");
    }

    const reminder = await prisma.$transaction(async (tx) => {
      await tx.reminder.deleteMany({
        where: {
          taskId: id,
          completed: false,
        },
      });

      return tx.reminder.create({
        data: {
          userId: user.id,
          taskId: id,
          title,
          remindAt,
          completed: false,
        },
      });
    });

    return ok({ reminder });
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

    await ensureTaskWriteAccess(user, id);

    await prisma.reminder.deleteMany({
      where: {
        taskId: id,
        completed: false,
      },
    });

    return ok({ removed: true, taskId: id });
  } catch (error) {
    return fail(error);
  }
}

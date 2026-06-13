import {
  ApiError,
  booleanValue,
  fail,
  ok,
  readBody,
  requireUser,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await readBody(request);
    const notificationSent = booleanValue(body.notificationSent);
    const completed = booleanValue(body.completed);

    if (notificationSent === undefined && completed === undefined) {
      throw new ApiError("No reminder updates provided.");
    }

    const reminder = await prisma.reminder.update({
      where: { id, userId: user.id },
      data: {
        notificationSentAt: notificationSent ? new Date() : undefined,
        completed,
      },
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

    const result = await prisma.reminder.deleteMany({
      where: {
        id,
        OR: [
          { userId: user.id },
          { event: { userId: user.id } },
          { event: { calendar: { ownerId: user.id } } },
          { task: { userId: user.id } },
          { task: { event: { userId: user.id } } },
          { task: { event: { calendar: { ownerId: user.id } } } },
        ],
      },
    });

    if (result.count === 0) {
      throw new ApiError(
        "Reminder was already deleted or is only a generated alert.",
        404,
      );
    }

    return ok({
      deleted: true,
      reminderId: id,
    });
  } catch (error) {
    return fail(error);
  }
}

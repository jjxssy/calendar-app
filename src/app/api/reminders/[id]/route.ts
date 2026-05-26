import { ApiError, booleanValue, fail, ok, readBody, requireUser } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
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

import { ApiError, fail, ok, requireUser } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

export async function DELETE(
  _request: Request,
  context: { params: Params },
) {
  try {
    const user = await requireUser();
    const { id: eventId } = await context.params;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        userId: true,
        title: true,
      },
    });

    if (!event) {
      throw new ApiError("Event not found.", 404);
    }

    if (event.userId !== user.id) {
      throw new ApiError("You can only remove shared previews from your own calendar.", 403);
    }

    const deleted = await prisma.event.deleteMany({
      where: {
        id: eventId,
        userId: user.id,
        description: {
          contains: "[[arcgenda-shared-event:",
        },
      },
    });

    if (deleted.count === 0) {
      throw new ApiError("Shared preview not found.", 404);
    }

    await prisma.activityHistory.create({
      data: {
        userId: user.id,
        action: "event.shared_preview_removed",
        details: `Removed shared event preview "${event.title}" from own calendar.`,
      },
    });

    return ok({ removed: true, eventId });
  } catch (error) {
    return fail(error);
  }
}

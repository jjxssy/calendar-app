import { ApiError, fail, ok, requireUser } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

const sharedEventPreviewMarker =
  /\[\[arcgenda-shared-event:(viewer|editor):([^\]]+)\]\]/;

export async function DELETE(
  _request: Request,
  context: { params: Params },
) {
  try {
    const user = await requireUser();
    const { id: eventId } = await context.params;

    const previewEvent = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        userId: true,
        title: true,
        description: true,
      },
    });

    if (!previewEvent) {
      throw new ApiError("Event not found.", 404);
    }

    if (previewEvent.userId !== user.id) {
      throw new ApiError(
        "You can only remove shared previews from your own calendar.",
        403,
      );
    }

    const match = previewEvent.description?.match(sharedEventPreviewMarker);
    const shareId = match?.[2];

    if (!shareId) {
      throw new ApiError("Shared preview not found.", 404);
    }

    const removed = await prisma.$transaction(async (tx) => {
      const share = await tx.eventShare.findFirst({
        where: {
          id: shareId,
          OR: [{ userId: user.id }, { email: user.email }],
        },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              calendarId: true,
              userId: true,
            },
          },
        },
      });

      if (!share) {
        throw new ApiError("Shared event access not found.", 404);
      }

      await tx.event.deleteMany({
        where: {
          id: eventId,
          userId: user.id,
          description: {
            contains: "[[arcgenda-shared-event:",
          },
        },
      });

      const updatedShare = await tx.eventShare.update({
        where: { id: share.id },
        data: {
          status: "revoked",
        },
      });

      await tx.activityHistory.create({
        data: {
          userId: user.id,
          eventId: share.eventId,
          calendarId: share.event.calendarId,
          action: "event.share_left",
          details: `${user.name ?? user.email} removed "${share.event.title}" from their calendar.`,
        },
      });

      return updatedShare;
    });

    return ok({
      removed: true,
      eventId,
      share: removed,
    });
  } catch (error) {
    return fail(error);
  }
}
import {
  ApiError,
  fail,
  ok,
  readBody,
  requireUser,
  stringValue,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string; shareId: string }>;

const sharedPreviewMarker =
  /\[\[arcgenda-shared-event:(viewer|editor):([^\]]+)\]\]/;

function roleValue(value: unknown): "editor" | "viewer" {
  const role = stringValue(value);

  if (role !== "editor" && role !== "viewer") {
    throw new ApiError("Role must be editor or viewer.");
  }

  return role;
}

async function requireOwnedEvent(eventId: string, userId: string) {
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      userId,
    },
    select: {
      id: true,
      userId: true,
      title: true,
    },
  });

  if (!event) {
    throw new ApiError("Only the event owner can manage recipients.", 403);
  }

  return event;
}

async function findRecipientUser(share: {
  userId?: string | null;
  email: string;
}) {
  if (share.userId) {
    const foundById = await prisma.user.findUnique({
      where: { id: share.userId },
      select: { id: true, email: true },
    });

    if (foundById) return foundById;
  }

  return prisma.user.findUnique({
    where: { email: share.email },
    select: { id: true, email: true },
  });
}

async function findAcceptedPreviewEvents({
  recipientUserId,
  shareId,
  originalEventId,
  originalOwnerId,
}: {
  recipientUserId: string;
  shareId: string;
  originalEventId: string;
  originalOwnerId: string;
}) {
  const previews = await prisma.event.findMany({
    where: {
      userId: recipientUserId,
      description: {
        contains: "[[arcgenda-shared-event:",
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
    },
  });

  return previews.filter((preview) => {
    const match = preview.description?.match(sharedPreviewMarker);
    if (!match) return false;

    const markerId = match[2];

    return (
      markerId === shareId ||
      markerId === originalEventId ||
      markerId === originalOwnerId
    );
  });
}

function replacePreviewRole(
  description: string | null | undefined,
  role: "editor" | "viewer",
) {
  if (!description) return description;

  return description.replace(
    sharedPreviewMarker,
    `[[arcgenda-shared-event:${role}:$2]]`,
  );
}

export async function PATCH(
  request: Request,
  context: { params: Params },
) {
  try {
    const user = await requireUser();
    const { id: eventId, shareId } = await context.params;
    const body = await readBody(request);
    const role = roleValue(body.role);

    const originalEvent = await requireOwnedEvent(eventId, user.id);

    const existingShare = await prisma.eventShare.findFirst({
      where: {
        id: shareId,
        eventId,
      },
    });

    if (!existingShare) {
      throw new ApiError("Share recipient not found.", 404);
    }

    const recipientUser = await findRecipientUser(existingShare);

    const previewEvents = recipientUser
      ? await findAcceptedPreviewEvents({
          recipientUserId: recipientUser.id,
          shareId: existingShare.id,
          originalEventId: existingShare.eventId,
          originalOwnerId: originalEvent.userId,
        })
      : [];

    const updatedShare = await prisma.$transaction(async (tx) => {
      const share = await tx.eventShare.update({
        where: { id: existingShare.id },
        data: { role },
      });

      for (const preview of previewEvents) {
        await tx.event.update({
          where: { id: preview.id },
          data: {
            description: replacePreviewRole(preview.description, role),
          },
        });
      }

      await tx.activityHistory.create({
        data: {
          eventId,
          userId: user.id,
          action: "event.share_role_updated",
          details: `Updated ${share.email} to ${role}`,
        },
      });

      return share;
    });

    console.log("EVENT SHARE ROLE UPDATED", {
      eventId,
      shareId,
      role: updatedShare.role,
      recipientUserId: recipientUser?.id ?? null,
      updatedPreviewEventIds: previewEvents.map((event) => event.id),
    });

    return ok({
      share: updatedShare,
      eventId,
      role: updatedShare.role,
      updatedPreviewEventIds: previewEvents.map((event) => event.id),
    });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Params },
) {
  try {
    const user = await requireUser();
    const { id: eventId, shareId } = await context.params;

    await requireOwnedEvent(eventId, user.id);

    const share = await prisma.eventShare.findFirst({
      where: {
        id: shareId,
        eventId,
      },
    });

    if (!share) {
      throw new ApiError("Share recipient not found.", 404);
    }

    await prisma.eventShare.update({
      where: { id: share.id },
      data: {
        status: "revoked",
      },
    });

    await prisma.activityHistory.create({
      data: {
        eventId,
        userId: user.id,
        action: "event.share_revoked",
        details: `Removed ${share.email} from event sharing`,
      },
    });

    return ok({ removed: true, eventId, shareId });
  } catch (error) {
    return fail(error);
  }
}

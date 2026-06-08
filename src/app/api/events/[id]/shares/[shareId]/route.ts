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

const roles = ["editor", "viewer"] as const;
const sharedPreviewMarker =
  /\[\[arcgenda-shared-event:(viewer|editor):([^\]]+)\]\]/;

async function requireEventOwner(eventId: string, userId: string) {
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
    const user = await prisma.user.findUnique({
      where: { id: share.userId },
      select: { id: true, email: true },
    });

    if (user) return user;
  }

  return prisma.user.findUnique({
    where: { email: share.email },
    select: { id: true, email: true },
  });
}

async function findAcceptedPreviewEvents(
  recipientUserId: string,
  share: { id: string; eventId: string },
  originalEvent: { userId: string; title: string },
) {
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

    const sourceId = match[2];

    return (
      sourceId === share.id ||
      sourceId === share.eventId ||
      (sourceId === originalEvent.userId && preview.title === originalEvent.title)
    );
  });
}

function replaceSharedPreviewRole(
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

    const role = stringValue(body.role) ?? "viewer";

    if (!roles.includes(role as (typeof roles)[number])) {
      throw new ApiError("Role must be editor or viewer.");
    }

    const originalEvent = await requireEventOwner(eventId, user.id);

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
      ? await findAcceptedPreviewEvents(
          recipientUser.id,
          existingShare,
          originalEvent,
        )
      : [];

    const share = await prisma.$transaction(async (tx) => {
      const updatedShare = await tx.eventShare.update({
        where: { id: existingShare.id },
        data: {
          role: role as (typeof roles)[number],
        },
      });

      await Promise.all(
        previewEvents.map((preview) =>
          tx.event.update({
            where: { id: preview.id },
            data: {
              description: replaceSharedPreviewRole(
                preview.description,
                role as "editor" | "viewer",
              ),
            },
          }),
        ),
      );

      await tx.activityHistory.create({
        data: {
          eventId,
          userId: user.id,
          action: "event.share_role_updated",
          details: `Updated ${updatedShare.email} to ${role}`,
        },
      });

      return updatedShare;
    });

    return ok({ share, eventId, role: share.role });
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

    await requireEventOwner(eventId, user.id);

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

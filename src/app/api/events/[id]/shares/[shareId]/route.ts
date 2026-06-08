import { ApiError, fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string; shareId: string }>;

const roles = ["editor", "viewer"] as const;

async function requireEventOwner(eventId: string, userId: string) {
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      userId,
    },
    select: { id: true },
  });

  if (!event) {
    throw new ApiError("Only the event owner can manage recipients.", 403);
  }

  return event;
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

    await requireEventOwner(eventId, user.id);

    const existingShare = await prisma.eventShare.findFirst({
      where: {
        id: shareId,
        eventId,
      },
    });

    if (!existingShare) {
      throw new ApiError("Share recipient not found.", 404);
    }

    const share = await prisma.eventShare.update({
      where: { id: existingShare.id },
      data: {
        role: role as (typeof roles)[number],
      },
    });

    await prisma.activityHistory.create({
      data: {
        eventId,
        userId: user.id,
        action: "event.share_role_updated",
        details: `Updated ${share.email} to ${role}`,
      },
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

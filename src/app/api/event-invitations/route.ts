import { ApiError, fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireUser();

    const invitations = await prisma.eventShare.findMany({
      where: {
        status: "pending",
        OR: [{ userId: user.id }, { email: user.email }],
      },
      include: {
        event: {
          include: {
            calendar: { include: { members: true } },
            category: true,
            tasks: true,
            reminders: true,
            shares: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return ok({ invitations });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readBody(request);

    const shareId = stringValue(body.shareId);
    const action = stringValue(body.action);

    if (!shareId) throw new ApiError("shareId is required.");
    if (action !== "accept" && action !== "decline") {
      throw new ApiError("action must be accept or decline.");
    }

    const share = await prisma.eventShare.findFirst({
      where: {
        id: shareId,
        status: "pending",
        OR: [{ userId: user.id }, { email: user.email }],
      },
      include: {
        event: true,
      },
    });

    if (!share) {
      throw new ApiError("Event invitation not found.", 404);
    }

    const updated = await prisma.eventShare.update({
      where: { id: share.id },
      data: {
        userId: user.id,
        email: user.email,
        status: action === "accept" ? "accepted" : "declined",
      },
    });

    await prisma.activityHistory.create({
      data: {
        eventId: share.eventId,
        calendarId: share.event.calendarId,
        userId: user.id,
        action: action === "accept" ? "event.share_accepted" : "event.share_declined",
        details: `${user.email} ${action === "accept" ? "accepted" : "declined"} "${share.event.title}"`,
      },
    });

    return ok({ share: updated });
  } catch (error) {
    return fail(error);
  }
}
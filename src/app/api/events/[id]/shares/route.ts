import { ApiError, fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

async function requireEventSharingAccess(eventId: string, userId: string) {
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      OR: [
        { userId },
        { calendar: { ownerId: userId } },
        {
          calendar: {
            members: {
              some: {
                userId,
                status: "accepted",
                role: { in: ["owner", "editor"] },
              },
            },
          },
        },
      ],
    },
    include: {
      shares: true,
    },
  });

  if (!event) {
    throw new ApiError("Event not found or you cannot share it.", 404);
  }

  return event;
}

export async function POST(
  request: Request,
  context: { params: Params },
) {
  try {
    const user = await requireUser();
    const { id: eventId } = await context.params;
    const body = await readBody(request);

    const email = stringValue(body.email)?.toLowerCase() ?? "";
    if (!email) throw new ApiError("Email is required.");
    const role = stringValue(body.role) || "viewer";

    if (!email) throw new ApiError("Email is required.");
    if (role !== "viewer" && role !== "editor") {
      throw new ApiError("Role must be viewer or editor.");
    }

    await requireEventSharingAccess(eventId, user.id);

    const share = await prisma.eventShare.upsert({
      where: {
        eventId_email: {
          eventId,
          email,
        },
      },
      update: {
        role,
        status: "pending",
      },
      create: {
        eventId,
        email,
        role,
        status: "pending",
      },
    });

    await prisma.activityHistory.create({
      data: {
        eventId,
        userId: user.id,
        action: "event.share_created",
        details: `Share invite sent to ${email}`,
      },
    });

    return ok({ share });
  } catch (error) {
    return fail(error);
  }
}
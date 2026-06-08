import { ApiError, fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

const EVENT_SHARE_FREE_MONTHLY_LIMIT = 2;
const roles = ["editor", "viewer"] as const;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function startOfCurrentMonth() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

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
    select: {
      id: true,
      title: true,
      userId: true,
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
    const role = stringValue(body.role) ?? "viewer";

    if (!email) throw new ApiError("Email is required.");
    if (!isValidEmail(email)) {
      throw new ApiError("Enter a valid email address.");
    }

    if (!roles.includes(role as (typeof roles)[number])) {
      throw new ApiError("Role must be editor or viewer.");
    }

    const event = await requireEventSharingAccess(eventId, user.id);

    const targetUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (!targetUser) {
      throw new ApiError("This user does not have an Arcgenda account yet.");
    }

    if (targetUser.id === user.id) {
      throw new ApiError("You cannot share an event with yourself.");
    }

    const existingShare = await prisma.eventShare.findFirst({
      where: {
        eventId,
        email: targetUser.email,
      },
    });

    if (user.plan !== "premium" && !existingShare) {
      const sharedEventsThisMonth = await prisma.eventShare.count({
        where: {
          createdAt: {
            gte: startOfCurrentMonth(),
          },
          event: {
            userId: user.id,
          },
        },
      });

      if (sharedEventsThisMonth >= EVENT_SHARE_FREE_MONTHLY_LIMIT) {
        throw new ApiError(
          "Free plan allows 2 shared event invites per month.",
          403,
        );
      }
    }

    const share = existingShare
      ? await prisma.eventShare.update({
          where: { id: existingShare.id },
          data: {
            userId: targetUser.id,
            email: targetUser.email,
            role: role as (typeof roles)[number],
            status: "pending",
          },
        })
      : await prisma.eventShare.create({
          data: {
            eventId,
            userId: targetUser.id,
            email: targetUser.email,
            role: role as (typeof roles)[number],
            status: "pending",
          },
        });

    await prisma.activityHistory.create({
      data: {
        eventId,
        userId: user.id,
        action: "event.share_created",
        details: `Share invite sent to ${targetUser.email}`,
      },
    });

    return ok({ share });
  } catch (error) {
    return fail(error);
  }
}
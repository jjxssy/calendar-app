import { ApiError, fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const FREE_TOTAL_CALENDAR_LIMIT = 3;
const FREE_SHARED_CALENDAR_LIMIT = 1;

export async function GET() {
  try {
    const user = await requireUser();

    const invitations = await prisma.calendarMember.findMany({
      where: {
        status: "pending",
        OR: [{ userId: user.id }, { email: user.email }],
      },
      include: {
        calendar: {
          include: {
            owner: { select: { id: true, email: true, name: true } },
            members: true,
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

    const memberId = stringValue(body.memberId);
    const action = stringValue(body.action);

    if (!memberId) throw new ApiError("memberId is required.");
    if (action !== "accept" && action !== "decline") {
      throw new ApiError("action must be accept or decline.");
    }

    const member = await prisma.calendarMember.findFirst({
      where: {
        id: memberId,
        status: "pending",
        OR: [{ userId: user.id }, { email: user.email }],
      },
      include: {
        calendar: {
          include: {
            owner: true,
            members: true,
          },
        },
      },
    });

    if (!member) {
      throw new ApiError("Calendar invitation not found.", 404);
    }

    if (action === "decline") {
      const declined = await prisma.calendarMember.update({
        where: { id: member.id },
        data: {
          userId: user.id,
          email: user.email,
          status: "declined",
        },
      });

      await prisma.activityHistory.create({
        data: {
          calendarId: member.calendarId,
          userId: user.id,
          action: "calendar.invite_declined",
          details: `${user.email} declined "${member.calendar.name}"`,
        },
      });

      return ok({ member: declined });
    }

    const isPremium = user.plan === "premium";

    if (!isPremium) {
      const totalCalendarCount = await prisma.calendar.count({
        where: {
          OR: [
            { ownerId: user.id },
            {
              members: {
                some: {
                  userId: user.id,
                  status: "accepted",
                },
              },
            },
          ],
        },
      });

      if (totalCalendarCount >= FREE_TOTAL_CALENDAR_LIMIT) {
        throw new ApiError(
          "Free plan allows up to 3 calendars. Shared calendars count too.",
          403,
        );
      }

      const acceptedSharedCount = await prisma.calendarMember.count({
        where: {
          userId: user.id,
          status: "accepted",
          calendar: {
            ownerId: { not: user.id },
          },
        },
      });

      if (acceptedSharedCount >= FREE_SHARED_CALENDAR_LIMIT) {
        throw new ApiError("Free plan allows one shared calendar.", 403);
      }
    }

    const accepted = await prisma.calendarMember.update({
      where: { id: member.id },
      data: {
        userId: user.id,
        email: user.email,
        status: "accepted",
      },
    });

    await prisma.activityHistory.create({
      data: {
        calendarId: member.calendarId,
        userId: user.id,
        action: "calendar.invite_accepted",
        details: `${user.email} accepted "${member.calendar.name}"`,
      },
    });

    return ok({ member: accepted });
  } catch (error) {
    return fail(error);
  }
}
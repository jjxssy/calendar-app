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
    user: { select: { id: true, email: true, name: true } },
    tasks: {
              include: {
                reminders: true,
                event: {
                  select: { id: true, title: true, status: true, startDate: true },
                },
              },
              orderBy: { createdAt: "asc" },
            },
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
    const targetCalendarId = stringValue(body.targetCalendarId);

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
        event: {
          include: {
            tasks: true,
            reminders: true,
          },
        },
      },
    });

    if (!share) {
      throw new ApiError("Event invitation not found.", 404);
    }

    if (action === "decline") {
      const updatedShare = await prisma.eventShare.update({
        where: { id: share.id },
        data: {
          userId: user.id,
          email: user.email,
          status: "declined",
        },
      });

      await prisma.activityHistory.create({
        data: {
          eventId: share.eventId,
          userId: user.id,
          action: "event.share_declined",
          details: `${user.email} declined "${share.event.title}"`,
        },
      });

      return ok({ share: updatedShare });
    }

    if (!targetCalendarId) {
      throw new ApiError("Choose a calendar to add this event to.");
    }

    const targetCalendar = await prisma.calendar.findFirst({
      where: {
        id: targetCalendarId,
        ownerId: user.id,
        shared: false,
      },
    });

    if (!targetCalendar) {
      throw new ApiError("Choose one of your personal non-shared calendars.", 403);
    }

    const copiedEvent = await prisma.$transaction(async (tx) => {
      const updatedShare = await tx.eventShare.update({
        where: { id: share.id },
        data: {
          userId: user.id,
          email: user.email,
          status: "accepted",
        },
      });

      const createdEvent = await tx.event.create({
        data: {
          userId: user.id,
          calendarId: targetCalendar.id,
          categoryId: null,
          createdById: user.id,
          updatedById: user.id,
          title: share.event.title,
          description: share.event.description
            ? `${share.event.description}\n\nShared event preview`
            : "Shared event preview",
          startDate: share.event.startDate,
          endDate: share.event.endDate,
          allDay: share.event.allDay,
          color: share.event.color,
          location: share.event.location,
          priority: share.event.priority,
          recurrence: "none",
          pinned: false,
          status: "scheduled",
          tasks: {
            create: share.event.tasks.map((task) => ({
              userId: user.id,
              title: task.title,
              description: task.description,
              completed: false,
              dueDate: task.dueDate,
              priority: task.priority,
            })),
          },
        },
        include: {
          calendar: { include: { members: true } },
          category: true,
          user: { select: { id: true, email: true, name: true } },
          tasks: {
            include: {
              reminders: true,
              event: {
                select: { id: true, title: true, status: true, startDate: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
          reminders: true,
          shares: true,
        },
      });

      await tx.activityHistory.create({
        data: {
          eventId: createdEvent.id,
          userId: user.id,
          action: "event.share_accepted",
          details: `${user.email} added "${share.event.title}" to ${targetCalendar.name}`,
        },
      });

      return { event: createdEvent, share: updatedShare };
    });

    return ok(copiedEvent);
  } catch (error) {
    return fail(error);
  }
}
import { ApiError, fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const FREE_CALENDAR_LIMIT = 3;

export async function GET() {
  try {
    const user = await requireUser();
    const calendars = await prisma.calendar.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id, status: "accepted" } } },
        ],
      },
      include: { members: true },
      orderBy: { createdAt: "asc" },
    });

    return ok({ calendars, limit: FREE_CALENDAR_LIMIT });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const count = await prisma.calendar.count({
      where: {
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id, status: "accepted" } } },
        ],
      },
    });
    if (count >= FREE_CALENDAR_LIMIT) {
      throw new ApiError("Free plan allows up to 3 calendars. Shared calendars count too.");
    }

    const body = await readBody(request);
    const name = stringValue(body.name);
    const color = stringValue(body.color);
    if (!name) throw new ApiError("name is required.");
    if (!color) throw new ApiError("color is required.");

    const calendar = await prisma.$transaction(async (tx) => {
      const created = await tx.calendar.create({
        data: {
          ownerId: user.id,
          name,
          color,
          visible: true,
          members: {
            create: {
              userId: user.id,
              email: user.email,
              role: "owner",
              status: "accepted",
            },
          },
        },
        include: { members: true },
      });

      await tx.activityHistory.create({
        data: {
          calendarId: created.id,
          userId: user.id,
          action: "calendar.created",
          details: `Created "${created.name}"`,
        },
      });

      return created;
    });

    return ok({ calendar }, 201);
  } catch (error) {
    return fail(error);
  }
}

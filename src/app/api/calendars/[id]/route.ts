import {
  ApiError,
  ensureOwnedCalendar,
  fail,
  ok,
  readBody,
  requireUser,
  stringValue,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await ensureOwnedCalendar(user.id, id);

    const body = await readBody(request);
    const name = stringValue(body.name);
    const color = stringValue(body.color);
    if (!name && !color) throw new ApiError("name or color is required.");

    const calendar = await prisma.calendar.update({
      where: { id },
      data: { name, color },
      include: { members: true },
    });

    await prisma.activityHistory.create({
      data: {
        calendarId: calendar.id,
        userId: user.id,
        action: "calendar.updated",
        details: `Updated "${calendar.name}"`,
      },
    });

    return ok({ calendar });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const calendar = await ensureOwnedCalendar(user.id, id);

    await prisma.$transaction(async (tx) => {
      await tx.event.updateMany({
        where: { calendarId: id },
        data: { status: "archived", archivedAt: new Date(), updatedById: user.id },
      });
      await tx.activityHistory.create({
        data: {
          calendarId: id,
          userId: user.id,
          action: "calendar.deleted",
          details: `Deleted "${calendar.name}" and archived its events`,
        },
      });
      await tx.calendar.delete({ where: { id } });
    });

    return ok({ calendar });
  } catch (error) {
    return fail(error);
  }
}

import { ApiError, ensureOwnedCalendar, fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const roles = ["owner", "editor", "viewer"] as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string; memberId: string }> }) {
  try {
    const user = await requireUser();
    const { id, memberId } = await context.params;
    await ensureOwnedCalendar(user.id, id);
    const body = await readBody(request);
    const role = stringValue(body.role);
    if (!role || !roles.includes(role as never)) throw new ApiError("role must be owner, editor, or viewer.");

    const member = await prisma.calendarMember.findFirst({ where: { id: memberId, calendarId: id } });
    if (!member) throw new ApiError("Calendar member not found.", 404);

    const updated = await prisma.$transaction(async (tx) => {
      if (role === "owner") {
        if (!member.userId) throw new ApiError("Ownership can only move to an accepted member.", 400);
        await tx.calendar.update({ where: { id }, data: { ownerId: member.userId } });
        await tx.calendarMember.updateMany({
          where: { calendarId: id, role: "owner" },
          data: { role: "editor" },
        });
      }

      const saved = await tx.calendarMember.update({
        where: { id: memberId },
        data: { role: role as (typeof roles)[number] },
      });

      await tx.activityHistory.create({
        data: {
          calendarId: id,
          userId: user.id,
          action: role === "owner" ? "calendar.ownership_transferred" : "calendar.member_role_updated",
          details: `Changed ${member.email} to ${role}`,
        },
      });

      return saved;
    });

    return ok({ member: updated });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; memberId: string }> }) {
  try {
    const user = await requireUser();
    const { id, memberId } = await context.params;

    const member = await prisma.calendarMember.findFirst({ where: { id: memberId, calendarId: id } });
    if (!member) throw new ApiError("Calendar member not found.", 404);
    if (member.role === "owner") throw new ApiError("The owner cannot be removed here.", 400);

    const isSelf = member.userId === user.id;
    if (!isSelf) await ensureOwnedCalendar(user.id, id);

    await prisma.$transaction(async (tx) => {
      await tx.calendarMember.delete({ where: { id: memberId } });
      await tx.activityHistory.create({
        data: {
          calendarId: id,
          userId: user.id,
          action: isSelf ? "calendar.member_left" : "calendar.member_removed",
          details: isSelf ? `${member.email} left the calendar` : `Removed ${member.email}`,
        },
      });
    });

    return ok({ member });
  } catch (error) {
    return fail(error);
  }
}

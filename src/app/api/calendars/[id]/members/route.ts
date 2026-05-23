import { ApiError, ensureCalendar, fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const roles = ["owner", "editor", "viewer"] as const;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const calendar = await ensureCalendar(user.id, id);
    if (calendar.ownerId !== user.id) {
      throw new ApiError("Only the calendar owner can add members.", 403);
    }
    if (!calendar.shared) {
      const sharedCount = await prisma.calendar.count({
        where: { ownerId: user.id, shared: true, NOT: { id } },
      });
      if (sharedCount >= 1) {
        throw new ApiError("Free plan allows one shared calendar.", 403);
      }
    }

    const body = await readBody(request);
    const email = stringValue(body.email)?.toLowerCase();
    const role = stringValue(body.role) ?? "viewer";
    if (!email) throw new ApiError("email is required.");
    if (!roles.includes(role as never)) {
      throw new ApiError("role must be owner, editor, or viewer.");
    }

    const member = await prisma.$transaction(async (tx) => {
      const created = await tx.calendarMember.upsert({
        where: { calendarId_email: { calendarId: id, email } },
        update: { role: role as (typeof roles)[number], status: "pending" },
        create: {
          calendarId: id,
          email,
          role: role as (typeof roles)[number],
          status: "pending",
        },
      });

      await tx.calendar.update({
        where: { id },
        data: { shared: true },
      });

      await tx.activityHistory.create({
        data: {
          calendarId: id,
          userId: user.id,
          action: "calendar.member_invited",
          details: `Prepared ${role} invite for ${email}`,
        },
      });

      return created;
    });

    return ok({ member, note: "Invite email delivery is not configured yet." }, 201);
  } catch (error) {
    return fail(error);
  }
}

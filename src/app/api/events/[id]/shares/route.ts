import { ApiError, ensureEvent, fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const roles = ["owner", "editor", "viewer"] as const;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await ensureEvent(user.id, id);

    const body = await readBody(request);
    const email = stringValue(body.email)?.toLowerCase();
    const role = stringValue(body.role) ?? "viewer";
    if (!email) throw new ApiError("email is required.");
    if (!roles.includes(role as never)) {
      throw new ApiError("role must be owner, editor, or viewer.");
    }

    const share = await prisma.$transaction(async (tx) => {
      const created = await tx.eventShare.upsert({
        where: { eventId_email: { eventId: id, email } },
        update: { role: role as (typeof roles)[number], status: "pending" },
        create: {
          eventId: id,
          email,
          role: role as (typeof roles)[number],
          status: "pending",
        },
      });

      await tx.activityHistory.create({
        data: {
          eventId: id,
          userId: user.id,
          action: "event.share_prepared",
          details: `Prepared ${role} event share for ${email}`,
        },
      });

      return created;
    });

    return ok({ share, note: "Invite email delivery is not configured yet." }, 201);
  } catch (error) {
    return fail(error);
  }
}

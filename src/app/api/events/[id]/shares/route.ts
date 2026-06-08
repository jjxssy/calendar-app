import { ApiError, ensureEditableEvent, fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const event = await ensureEditableEvent(user.id, id);

    const body = await readBody(request);
    const email = stringValue(body.email)?.toLowerCase();

    if (!email) throw new ApiError("email is required.");
    if (email === user.email.toLowerCase()) {
      throw new ApiError("You already own this event.");
    }

    const share = await prisma.$transaction(async (tx) => {
      const created = await tx.eventShare.upsert({
        where: {
          eventId_email: {
            eventId: id,
            email,
          },
        },
        update: {
          role: "viewer",
          status: "pending",
        },
        create: {
          eventId: id,
          email,
          role: "viewer",
          status: "pending",
        },
      });

      await tx.activityHistory.create({
        data: {
          calendarId: event.calendarId,
          eventId: id,
          userId: user.id,
          action: "event.share_prepared",
          details: `Prepared viewer event preview for ${email}`,
        },
      });

      return created;
    });

    return ok({ share, note: "Event preview invite prepared." }, 201);
  } catch (error) {
    return fail(error);
  }
}
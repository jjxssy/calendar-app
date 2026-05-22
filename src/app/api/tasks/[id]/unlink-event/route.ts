import { ensureTask, fail, ok, requireUser } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await ensureTask(user.id, id);

    const task = await prisma.task.update({
      where: { id },
      data: { eventId: null },
      include: { event: true, reminders: true },
    });

    return ok({ task });
  } catch (error) {
    return fail(error);
  }
}

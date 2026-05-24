import { fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const body: Record<string, unknown> = await readBody(request).catch(() => ({}));
    const endpoint = stringValue(body.endpoint);

    const result = await prisma.pushSubscription.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
        ...(endpoint ? { endpoint } : {}),
      },
      data: { revokedAt: new Date() },
    });

    return ok({ revoked: result.count });
  } catch (error) {
    return fail(error);
  }
}

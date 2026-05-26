import { fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { getVapidPublicKey, isWebPushConfigured } from "@/lib/web-push";

function keyValue(keys: unknown, name: "p256dh" | "auth") {
  if (!keys || typeof keys !== "object") return undefined;
  const value = (keys as Record<string, unknown>)[name];
  return typeof value === "string" ? value : undefined;
}

export async function GET() {
  try {
    const user = await requireUser();
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: user.id, revokedAt: null },
      select: { id: true, endpoint: true, userAgent: true, deviceLabel: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    return ok({
      publicKey: getVapidPublicKey(),
      configured: isWebPushConfigured(),
      cronConfigured: Boolean(process.env.CRON_SECRET || process.env.VERCEL),
      subscriptions,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readBody(request);
    const endpoint = stringValue(body.endpoint);
    const p256dh = keyValue(body.keys, "p256dh");
    const auth = keyValue(body.keys, "auth");

    if (!endpoint || !p256dh || !auth) {
      return Response.json({ error: "A valid browser push subscription is required." }, { status: 400 });
    }

    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId: user.id,
        p256dh,
        auth,
        userAgent: request.headers.get("user-agent"),
        deviceLabel: stringValue(body.deviceLabel),
        revokedAt: null,
      },
      create: {
        userId: user.id,
        endpoint,
        p256dh,
        auth,
        userAgent: request.headers.get("user-agent"),
        deviceLabel: stringValue(body.deviceLabel),
      },
    });

    return ok({ subscription });
  } catch (error) {
    return fail(error);
  }
}

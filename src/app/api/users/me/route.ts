import {
  ApiError,
  booleanValue,
  fail,
  ok,
  readBody,
  requireUser,
  stringValue,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeTheme(value: unknown) {
  if (value === "light" || value === "dark" || value === "system") return value;
  if (value === "white") return "light";
  return "system";
}

function userPayload<T extends { theme?: string | null; skipIntro?: boolean | null }>(user: T) {
  return {
    ...user,
    theme: normalizeTheme(user.theme),
    skipIntro: user.skipIntro === true,
  };
}

export async function GET() {
  try {
    const user = await requireUser();
    return ok({ user: userPayload(user) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST() {
  try {
    const user = await requireUser();
    return ok({ user: userPayload(user) });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await readBody(request);
    const theme = stringValue(body.theme);
    const skipIntro = booleanValue(body.skipIntro);

    if (theme && !["system", "light", "dark"].includes(theme)) {
      throw new ApiError("theme must be system, light, or dark.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const savedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          name: stringValue(body.name),
          theme,
          skipIntro,
        },
      });

      const displayNames = body.calendarDisplayNames;
      if (displayNames && typeof displayNames === "object" && !Array.isArray(displayNames)) {
        await Promise.all(
          Object.entries(displayNames as Record<string, unknown>).map(([calendarId, value]) =>
            tx.calendarMember.updateMany({
              where: {
                calendarId,
                userId: user.id,
                status: "accepted",
              },
              data: { displayName: stringValue(value) ?? null },
            }),
          ),
        );
      }

      return savedUser;
    });

    return ok({ user: userPayload(updated) });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE() {
  return fail(
    new ApiError(
      "Account deletion needs Supabase Auth admin configuration before it can run safely.",
      501,
    ),
  );
}

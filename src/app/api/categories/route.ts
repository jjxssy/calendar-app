import { ApiError, fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireUser();
    const categories = await prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    });

    return ok({ categories });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readBody(request);
    const name = stringValue(body.name);
    const color = stringValue(body.color);

    if (!name) throw new ApiError("name is required.");
    if (!color) throw new ApiError("color is required.");

    const category = await prisma.category.create({
      data: {
        userId: user.id,
        name,
        color,
        icon: stringValue(body.icon),
      },
    });

    return ok({ category }, 201);
  } catch (error) {
    return fail(error);
  }
}

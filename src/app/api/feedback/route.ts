import { ApiError, fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const categories = ["feedback", "bug", "feature", "contact"] as const;

export async function POST(request: Request) {
  try {
    let userId: string | undefined;
    try {
      userId = (await requireUser()).id;
    } catch {
      userId = undefined;
    }

    const body = await readBody(request);
    const name = stringValue(body.name);
    const email = stringValue(body.email);
    const message = stringValue(body.message);
    const category = stringValue(body.category) ?? "feedback";

    if (!name) throw new ApiError("name is required.");
    if (!email) throw new ApiError("email is required.");
    if (!message) throw new ApiError("message is required.");
    if (!categories.includes(category as never)) {
      throw new ApiError("category must be feedback, bug, feature, or contact.");
    }

    const feedback = await prisma.feedback.create({
      data: {
        userId,
        name,
        email,
        message,
        category: category as (typeof categories)[number],
      },
    });

    return ok({ feedback }, 201);
  } catch (error) {
    return fail(error);
  }
}

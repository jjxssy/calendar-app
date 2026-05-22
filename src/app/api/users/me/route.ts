import { fail, ok, requireUser } from "@/lib/api-helpers";

export async function GET() {
  try {
    const user = await requireUser();
    return ok({ user });
  } catch (error) {
    return fail(error);
  }
}

export async function POST() {
  try {
    const user = await requireUser();
    return ok({ user });
  } catch (error) {
    return fail(error);
  }
}

import { ApiError, booleanValue, dateValue, ensureCategory, fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const priorities = ["low", "normal", "high", "urgent"] as const;
const statuses = ["scheduled", "completed", "cancelled", "archived"] as const;

function priorityValue(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !priorities.includes(value as never)) {
    throw new ApiError("priority must be low, normal, high, or urgent.");
  }
  return value as (typeof priorities)[number];
}

function statusValue(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !statuses.includes(value as never)) {
    throw new ApiError("status must be scheduled, completed, cancelled, or archived.");
  }
  return value as (typeof statuses)[number];
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const includeArchived = url.searchParams.get("includeArchived") === "true";
    const q = url.searchParams.get("q")?.trim();

    const events = await prisma.event.findMany({
      where: {
        userId: user.id,
        archivedAt: includeArchived ? undefined : null,
        status: statusValue(url.searchParams.get("status") ?? undefined),
        categoryId: url.searchParams.get("categoryId") ?? undefined,
        startDate: {
          gte: dateValue(url.searchParams.get("from") ?? undefined, "from"),
          lte: dateValue(url.searchParams.get("to") ?? undefined, "to"),
        },
        OR: q
          ? [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { location: { contains: q, mode: "insensitive" } },
            ]
          : undefined,
      },
      include: { category: true, tasks: true, reminders: true },
      orderBy: [{ pinned: "desc" }, { startDate: "asc" }],
    });

    return ok({ events });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readBody(request);
    const title = stringValue(body.title);
    const startDate = dateValue(body.startDate, "startDate");
    const categoryId = stringValue(body.categoryId);

    if (!title) throw new ApiError("title is required.");
    if (!startDate) throw new ApiError("startDate is required.");
    if (categoryId) await ensureCategory(user.id, categoryId);

    const event = await prisma.event.create({
      data: {
        userId: user.id,
        categoryId,
        title,
        description: stringValue(body.description),
        startDate,
        endDate: dateValue(body.endDate, "endDate"),
        allDay: booleanValue(body.allDay) ?? false,
        color: stringValue(body.color),
        location: stringValue(body.location),
        url: stringValue(body.url),
        priority: priorityValue(body.priority) ?? "normal",
        pinned: booleanValue(body.pinned) ?? false,
      },
      include: { category: true, tasks: true, reminders: true },
    });

    return ok({ event }, 201);
  } catch (error) {
    return fail(error);
  }
}

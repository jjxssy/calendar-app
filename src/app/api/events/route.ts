import { ApiError, booleanValue, dateValue, ensureCategory, ensureWritableCalendar, fail, ok, readBody, requireUser, stringValue } from "@/lib/api-helpers";
import { withEventActor, withEventActors } from "@/lib/event-response";
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
    const status = statusValue(url.searchParams.get("status") ?? undefined);

    const events = await prisma.event.findMany({
      where: {
        AND: [
          {
            OR: [
              { userId: user.id },
              { calendar: { members: { some: { userId: user.id, status: "accepted" } } } },
              { shares: { some: { userId: user.id, status: "accepted" } } },
            ],
          },
          {
            OR: q
              ? [
                  { title: { contains: q, mode: "insensitive" } },
                  { description: { contains: q, mode: "insensitive" } },
                  { location: { contains: q, mode: "insensitive" } },
                ]
              : undefined,
          },
        ],
        status: status ?? (includeArchived ? undefined : { not: "archived" }),
        categoryId: url.searchParams.get("categoryId") ?? undefined,
        startDate: {
          gte: dateValue(url.searchParams.get("from") ?? undefined, "from"),
          lte: dateValue(url.searchParams.get("to") ?? undefined, "to"),
        },
      },
      include: {
        calendar: { include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } } },
        category: true,
        tasks: true,
        reminders: true,
        shares: true,
      },
      orderBy: [{ pinned: "desc" }, { startDate: "asc" }],
    });

    return ok({ events: await withEventActors(events) });
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
    let calendarId = stringValue(body.calendarId);

    if (!title) throw new ApiError("title is required.");
    if (!startDate) throw new ApiError("startDate is required.");
    if (categoryId) await ensureCategory(user.id, categoryId);
    if (!calendarId) {
      const defaultCalendar = await prisma.calendar.findFirst({
        where: {
          OR: [
            { ownerId: user.id },
            {
              members: {
                some: {
                  userId: user.id,
                  status: "accepted",
                  role: { in: ["owner", "editor"] },
                },
              },
            },
          ],
        },
        orderBy: { createdAt: "asc" },
      });
      calendarId = defaultCalendar?.id;
    }
    if (calendarId) await ensureWritableCalendar(user.id, calendarId);

    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          userId: user.id,
          calendarId,
          categoryId,
          createdById: user.id,
          updatedById: user.id,
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
        include: {
          calendar: { include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } } },
          category: true,
          tasks: true,
          reminders: true,
          shares: true,
        },
      });

      await tx.activityHistory.create({
        data: {
          calendarId,
          eventId: created.id,
          userId: user.id,
          action: "event.created",
          details: `Created "${created.title}"`,
        },
      });

      return created;
    });

    return ok({ event: await withEventActor(event) }, 201);
  } catch (error) {
    return fail(error);
  }
}

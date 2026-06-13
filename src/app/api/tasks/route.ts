import {
  ApiError,
  dateValue,
  ensureEvent,
  fail,
  ok,
  readBody,
  requireUser,
  stringValue,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const priorities = ["low", "normal", "high", "urgent"] as const;

const sharedEventPreviewMarker =
  /\[\[arcgenda-shared-event:(viewer|editor):([^\]]+)\]\]/;

async function resolveWritableEventId(
  user: { id: string; email: string },
  requestedEventId?: string,
) {
  if (!requestedEventId) return undefined;

  const event = await prisma.event.findFirst({
    where: {
      id: requestedEventId,
      OR: [
        { userId: user.id },
        { user: { email: user.email } },
        { calendar: { ownerId: user.id } },
        { calendar: { owner: { email: user.email } } },
        {
          calendar: {
            members: {
              some: {
                OR: [{ userId: user.id }, { email: user.email }],
                status: "accepted",
                role: { in: ["owner", "editor"] },
              },
            },
          },
        },
        {
          shares: {
            some: {
              OR: [{ userId: user.id }, { email: user.email }],
              status: "accepted",
              role: "editor",
            },
          },
        },
      ],
    },
  });

  if (!event) {
    throw new ApiError("You do not have permission to add a task here.", 403);
  }

  const previewMatch = event.description?.match(sharedEventPreviewMarker);

  if (!previewMatch) return event.id;

  const role = previewMatch[1] as "viewer" | "editor";
  const shareId = previewMatch[2];

  if (role !== "editor") {
    throw new ApiError("You only have view access to this shared event.", 403);
  }

  const share = await prisma.eventShare.findFirst({
    where: {
      id: shareId,
      status: "accepted",
      role: "editor",
      OR: [{ userId: user.id }, { email: user.email }],
    },
  });

  if (!share) {
    throw new ApiError("You only have view access to this shared event.", 403);
  }

  return share.eventId;
}

function priorityValue(value: unknown) {
  if (value === undefined) return undefined;

  if (typeof value !== "string" || !priorities.includes(value as never)) {
    throw new ApiError("priority must be low, normal, high, or urgent.");
  }

  return value as (typeof priorities)[number];
}

function cleanTaskDescription(description?: string | null) {
  return (description ?? "")
    .replace(/\n?\n?\[\[arcgenda-shared-task:[^\]]+\]\]/g, "")
    .trim();
}

function descriptionWithTaskMarker(
  description: string | null | undefined,
  originalTaskId: string,
) {
  const clean = cleanTaskDescription(description);

  return `${clean}${clean ? "\n\n" : ""}[[arcgenda-shared-task:${originalTaskId}]]`;
}

function taskAccessWhere(user: { id: string; email: string }) {
  return {
    OR: [
      { userId: user.id },
      { user: { email: user.email } },
      { event: { userId: user.id } },
      { event: { user: { email: user.email } } },
      { event: { calendar: { ownerId: user.id } } },
      { event: { calendar: { owner: { email: user.email } } } },
      {
        event: {
          calendar: {
            members: {
              some: {
                OR: [{ userId: user.id }, { email: user.email }],
                status: "accepted" as const,
              },
            },
          },
        },
      },
    ],
  };
}

async function syncOriginalTasksToAcceptedPreviews(originalEventId: string) {
  const originalEvent = await prisma.event.findUnique({
    where: { id: originalEventId },
    include: {
      tasks: {
        orderBy: { createdAt: "asc" },
      },
      shares: {
        where: { status: "accepted" },
      },
    },
  });

  if (!originalEvent) return;

  await prisma.$transaction(async (tx) => {
    for (const share of originalEvent.shares) {
      const previewEvents = await tx.event.findMany({
        where: {
          userId: share.userId ?? undefined,
          description: {
            contains: `[[arcgenda-shared-event:${share.role}:${share.id}]]`,
          },
        },
        select: {
          id: true,
          userId: true,
        },
      });

      for (const previewEvent of previewEvents) {
        await tx.task.deleteMany({
          where: { eventId: previewEvent.id },
        });

        if (originalEvent.tasks.length > 0) {
          await tx.task.createMany({
            data: originalEvent.tasks.map((task) => ({
              userId: previewEvent.userId,
              eventId: previewEvent.id,
              title: task.title,
              description: descriptionWithTaskMarker(task.description, task.id),
              completed: task.completed,
              dueDate: task.dueDate,
              priority: task.priority,
            })),
          });
        }
      }
    }
  });
}

async function resolveEventForTaskCreate(
  user: { id: string; email: string },
  eventId: string | undefined,
) {
  if (!eventId) return undefined;

  const event = await ensureEvent(user.id, eventId);
  const previewMatch = event.description?.match(sharedEventPreviewMarker);

  if (!previewMatch) return eventId;

  const role = previewMatch[1] as "viewer" | "editor";
  const shareId = previewMatch[2];

  if (role !== "editor") {
    throw new ApiError("You only have view access to this shared event.", 403);
  }

  const share = await prisma.eventShare.findFirst({
    where: {
      id: shareId,
      status: "accepted",
      role: "editor",
      OR: [{ userId: user.id }, { email: user.email }],
    },
  });

  if (!share) {
    throw new ApiError("You only have view access to this shared event.", 403);
  }

  return share.eventId;
}

export async function GET() {
  try {
    const user = await requireUser();

    const tasks = await prisma.task.findMany({
      where: taskAccessWhere(user),
      include: {
        event: true,
        reminders: true,
      },
      orderBy: [
        { completed: "asc" },
        { dueDate: "asc" },
        { createdAt: "desc" },
      ],
    });

    return ok({ tasks });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readBody(request);

    const title = stringValue(body.title);
    const rawEventId = stringValue(body.eventId);
    const requestedEventId =
      rawEventId && rawEventId !== "none" ? rawEventId : undefined;
    const dueDate = dateValue(body.dueDate, "dueDate");

    if (!title) throw new ApiError("title is required.");

    const eventId = await resolveEventForTaskCreate(user, requestedEventId);

    const writableEventId = await resolveWritableEventId(user, eventId);

const task = await prisma.task.create({
  data: {
    userId: user.id,
    eventId: writableEventId,
        title,
        description: stringValue(body.description),
        completed: false,
        dueDate,
        priority: priorityValue(body.priority) ?? "normal",
      },
      include: {
        event: true,
        reminders: true,
      },
    });

    if (task.eventId) {
      await syncOriginalTasksToAcceptedPreviews(task.eventId);
    }

    return ok({ task }, 201);
  } catch (error) {
    return fail(error);
  }
}
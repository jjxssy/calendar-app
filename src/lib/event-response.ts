import { prisma } from "@/lib/prisma";

type EventActorIds = {
  createdById?: string | null;
  updatedById?: string | null;
};

type EventActor = {
  id: string;
  name: string | null;
  email: string;
};

export async function withEventActors<T extends EventActorIds>(
  events: T[],
): Promise<Array<T & { createdBy: EventActor | null; updatedBy: EventActor | null }>> {
  const actorIds = Array.from(
    new Set(
      events
        .flatMap((event) => [event.createdById, event.updatedById])
        .filter((id): id is string => Boolean(id)),
    ),
  );

  if (actorIds.length === 0) {
    return events.map((event) => ({ ...event, createdBy: null, updatedBy: null }));
  }

  const users = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true, email: true },
  });
  const userById = new Map(users.map((user) => [user.id, user]));

  return events.map((event) => ({
    ...event,
    createdBy: event.createdById ? (userById.get(event.createdById) ?? null) : null,
    updatedBy: event.updatedById ? (userById.get(event.updatedById) ?? null) : null,
  }));
}

export async function withEventActor<T extends EventActorIds>(
  event: T,
): Promise<T & { createdBy: EventActor | null; updatedBy: EventActor | null }> {
  const [withActors] = await withEventActors([event]);
  return withActors;
}

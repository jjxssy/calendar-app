import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CancelEventDto, CreateEventDto, UpdateEventDto } from "./dto";

type ListFilters = {
  from?: string;
  to?: string;
  q?: string;
  categoryId?: string;
  priority?: string;
  status?: string;
};

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string, filters: ListFilters) {
    return this.prisma.event.findMany({
      where: {
        userId,
        archivedAt: null,
        deletedAt: null,
        categoryId: filters.categoryId,
        priority: filters.priority as never,
        status: filters.status as never,
        startsAt: {
          gte: filters.from ? new Date(filters.from) : undefined,
          lte: filters.to ? new Date(filters.to) : undefined,
        },
        OR: filters.q
          ? [
              { title: { contains: filters.q, mode: "insensitive" } },
              { description: { contains: filters.q, mode: "insensitive" } },
              { location: { contains: filters.q, mode: "insensitive" } },
            ]
          : undefined,
      },
      include: {
        category: true,
        tasks: true,
        reminders: true,
        rescheduleReminders: true,
      },
      orderBy: [{ pinned: "desc" }, { startsAt: "asc" }],
    });
  }

  async findOne(userId: string, id: string) {
    const event = await this.prisma.event.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        category: true,
        tasks: true,
        reminders: true,
        rescheduleReminders: true,
      },
    });

    if (!event) {
      throw new NotFoundException("Event not found.");
    }

    return event;
  }

  create(userId: string, dto: CreateEventDto) {
    return this.prisma.event.create({
      data: {
        ...dto,
        userId,
        status: "SCHEDULED",
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      },
      include: {
        category: true,
        tasks: true,
        reminders: true,
        rescheduleReminders: true,
      },
    });
  }

  update(userId: string, id: string, dto: UpdateEventDto) {
    return this.prisma.event.update({
      where: { id, userId },
      data: {
        ...dto,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      },
      include: {
        category: true,
        tasks: true,
        reminders: true,
        rescheduleReminders: true,
      },
    });
  }

  archive(userId: string, id: string) {
    return this.prisma.event.update({
      where: { id, userId },
      data: { archivedAt: new Date(), status: "ARCHIVED" },
    });
  }

  async cancel(userId: string, id: string, dto: CancelEventDto) {
    const event = await this.findOne(userId, id);
    const cancelledAt = new Date();

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const cancelled = await tx.event.update({
        where: { id: event.id, userId },
        data: {
          status: "CANCELLED",
          cancellationReason: dto.cancellationReason?.trim() || null,
          cancelledAt,
        },
        include: {
          category: true,
          tasks: true,
          reminders: true,
          rescheduleReminders: true,
        },
      });

      if (dto.createRescheduleReminder && dto.reminderAt) {
        const title = `Reschedule: ${event.title}`;

        await tx.reminder.create({
          data: {
            userId,
            rescheduleForEventId: event.id,
            title,
            remindAt: new Date(dto.reminderAt),
          },
        });

        await tx.eventTask.create({
          data: {
            eventId: event.id,
            linkedCancelledEventId: event.id,
            title,
          },
        });
      }

      return cancelled;
    });
  }

  undoCancel(userId: string, id: string) {
    return this.prisma.event.update({
      where: { id, userId },
      data: {
        status: "SCHEDULED",
        cancellationReason: null,
        cancelledAt: null,
      },
      include: {
        category: true,
        tasks: true,
        reminders: true,
        rescheduleReminders: true,
      },
    });
  }
}

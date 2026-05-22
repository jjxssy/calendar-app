import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertEventBelongsToUser(userId: string, eventId?: string | null) {
    if (!eventId) return;

    const event = await this.prisma.event.findFirst({
      where: { id: eventId, userId, deletedAt: null },
      select: { id: true },
    });

    if (!event) {
      throw new NotFoundException("Event not found.");
    }
  }

  list(userId: string) {
    return this.prisma.task.findMany({
      where: { userId },
      include: { event: true, linkedCancelledEvent: true },
      orderBy: [{ done: "asc" }, { createdAt: "desc" }],
    });
  }

  async create(
    userId: string,
    dto: { eventId?: string | null; title: string; reminderAt?: string; sortOrder?: number },
  ) {
    await this.assertEventBelongsToUser(userId, dto.eventId);

    return this.prisma.task.create({
      data: {
        userId,
        eventId: dto.eventId || null,
        title: dto.title,
        reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : undefined,
        sortOrder: dto.sortOrder,
      },
      include: { event: true, linkedCancelledEvent: true },
    });
  }

  async update(
    userId: string,
    id: string,
    data: { title?: string; done?: boolean; eventId?: string | null; reminderAt?: string | null },
  ) {
    const task = await this.prisma.task.findFirst({ where: { id, userId } });
    if (!task) {
      throw new NotFoundException("Task not found.");
    }
    await this.assertEventBelongsToUser(userId, data.eventId);

    return this.prisma.task.update({
      where: { id },
      data: {
        title: data.title,
        done: data.done,
        eventId: data.eventId === undefined ? undefined : data.eventId,
        reminderAt:
          data.reminderAt === undefined
            ? undefined
            : data.reminderAt
              ? new Date(data.reminderAt)
              : null,
      },
      include: { event: true, linkedCancelledEvent: true },
    });
  }

  unlink(userId: string, id: string) {
    return this.update(userId, id, { eventId: null });
  }

  async remove(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({ where: { id, userId } });
    if (!task) {
      throw new NotFoundException("Task not found.");
    }

    return this.prisma.task.delete({ where: { id } });
  }
}

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: { eventId: string; title: string; sortOrder?: number }) {
    return this.prisma.eventTask.create({ data: dto });
  }

  update(id: string, data: { title?: string; done?: boolean }) {
    return this.prisma.eventTask.update({ where: { id }, data });
  }
}

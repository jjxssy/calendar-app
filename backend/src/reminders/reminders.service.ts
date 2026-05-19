import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.reminder.findMany({ where: { userId }, orderBy: { remindAt: "asc" } });
  }

  create(userId: string, dto: { title?: string; eventId?: string; remindAt: string }) {
    return this.prisma.reminder.create({
      data: { ...dto, userId, remindAt: new Date(dto.remindAt) },
    });
  }
}

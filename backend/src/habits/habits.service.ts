import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class HabitsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.habit.findMany({ where: { userId, archivedAt: null }, include: { entries: true } });
  }

  create(userId: string, dto: { name: string; color: string; targetCount?: number }) {
    return this.prisma.habit.create({ data: { ...dto, userId } });
  }

  log(dto: { habitId: string; date: string; count?: number; notes?: string }) {
    const date = new Date(dto.date);
    return this.prisma.habitEntry.upsert({
      where: { habitId_date: { habitId: dto.habitId, date } },
      create: { habitId: dto.habitId, date, count: dto.count ?? 1, notes: dto.notes },
      update: { count: dto.count, notes: dto.notes },
    });
  }
}

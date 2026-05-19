import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DayNotesService {
  constructor(private readonly prisma: PrismaService) {}

  find(userId: string, date: string) {
    return this.prisma.dayNote.findUnique({
      where: { userId_date: { userId, date: new Date(date) } },
    });
  }

  upsert(userId: string, dto: { date: string; body: string; pinned?: boolean }) {
    const date = new Date(dto.date);
    return this.prisma.dayNote.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, body: dto.body, pinned: dto.pinned ?? false },
      update: { body: dto.body, pinned: dto.pinned },
    });
  }
}

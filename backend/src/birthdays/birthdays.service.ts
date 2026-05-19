import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class BirthdaysService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.birthday.findMany({ where: { userId }, orderBy: { date: "asc" } });
  }

  create(userId: string, dto: { name: string; date: string; notes?: string }) {
    return this.prisma.birthday.create({
      data: { ...dto, userId, date: new Date(dto.date) },
    });
  }
}

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.category.findMany({
      where: { userId, archivedAt: null },
      orderBy: { createdAt: "asc" },
    });
  }

  create(userId: string, dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: { ...dto, userId } });
  }

  update(userId: string, id: string, dto: UpdateCategoryDto) {
    return this.prisma.category.update({
      where: { id, userId },
      data: dto,
    });
  }
}

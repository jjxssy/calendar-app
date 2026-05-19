import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthUser, CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { HabitsService } from "./habits.service";

@UseGuards(JwtAuthGuard)
@Controller("habits")
export class HabitsController {
  constructor(private readonly habitsService: HabitsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.habitsService.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: { name: string; color: string; targetCount?: number }) {
    return this.habitsService.create(user.id, dto);
  }

  @Post("entries")
  log(@Body() dto: { habitId: string; date: string; count?: number; notes?: string }) {
    return this.habitsService.log(dto);
  }
}

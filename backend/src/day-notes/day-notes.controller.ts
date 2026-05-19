import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { AuthUser, CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { DayNotesService } from "./day-notes.service";

@UseGuards(JwtAuthGuard)
@Controller("day-notes")
export class DayNotesController {
  constructor(private readonly dayNotesService: DayNotesService) {}

  @Get()
  find(@CurrentUser() user: AuthUser, @Query("date") date: string) {
    return this.dayNotesService.find(user.id, date);
  }

  @Post()
  upsert(@CurrentUser() user: AuthUser, @Body() dto: { date: string; body: string; pinned?: boolean }) {
    return this.dayNotesService.upsert(user.id, dto);
  }
}

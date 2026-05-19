import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthUser, CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RemindersService } from "./reminders.service";

@UseGuards(JwtAuthGuard)
@Controller("reminders")
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.remindersService.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: { title?: string; eventId?: string; remindAt: string }) {
    return this.remindersService.create(user.id, dto);
  }
}

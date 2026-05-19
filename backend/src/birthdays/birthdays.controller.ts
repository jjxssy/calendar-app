import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthUser, CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { BirthdaysService } from "./birthdays.service";

@UseGuards(JwtAuthGuard)
@Controller("birthdays")
export class BirthdaysController {
  constructor(private readonly birthdaysService: BirthdaysService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.birthdaysService.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: { name: string; date: string; notes?: string }) {
    return this.birthdaysService.create(user.id, dto);
  }
}

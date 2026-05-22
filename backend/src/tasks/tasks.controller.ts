import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthUser, CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TasksService } from "./tasks.service";

@UseGuards(JwtAuthGuard)
@Controller("tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.tasksService.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: { eventId?: string | null; title: string; reminderAt?: string; sortOrder?: number },
  ) {
    return this.tasksService.create(user.id, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: { title?: string; done?: boolean; eventId?: string | null; reminderAt?: string | null },
  ) {
    return this.tasksService.update(user.id, id, dto);
  }

  @Patch(":id/unlink")
  unlink(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.tasksService.unlink(user.id, id);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.tasksService.remove(user.id, id);
  }
}

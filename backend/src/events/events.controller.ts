import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthUser, CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CancelEventDto, CreateEventDto, UpdateEventDto } from "./dto";
import { EventsService } from "./events.service";

@UseGuards(JwtAuthGuard)
@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("q") q?: string,
    @Query("categoryId") categoryId?: string,
    @Query("priority") priority?: string,
    @Query("status") status?: string,
  ) {
    return this.eventsService.list(user.id, { from, to, q, categoryId, priority, status });
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEventDto) {
    return this.eventsService.create(user.id, dto);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.eventsService.findOne(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventsService.update(user.id, id, dto);
  }

  @Patch(":id/cancel")
  cancel(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: CancelEventDto,
  ) {
    return this.eventsService.cancel(user.id, id, dto);
  }

  @Patch(":id/undo-cancel")
  undoCancel(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.eventsService.undoCancel(user.id, id);
  }

  @Delete(":id")
  archive(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.eventsService.archive(user.id, id);
  }
}

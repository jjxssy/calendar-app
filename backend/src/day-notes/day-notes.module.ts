import { Module } from "@nestjs/common";
import { DayNotesController } from "./day-notes.controller";
import { DayNotesService } from "./day-notes.service";

@Module({
  controllers: [DayNotesController],
  providers: [DayNotesService],
})
export class DayNotesModule {}

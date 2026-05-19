import { Module } from "@nestjs/common";
import { BirthdaysController } from "./birthdays.controller";
import { BirthdaysService } from "./birthdays.service";

@Module({
  controllers: [BirthdaysController],
  providers: [BirthdaysService],
})
export class BirthdaysModule {}

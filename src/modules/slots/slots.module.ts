import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Slot, SlotSchema } from './schemas/slot.schema';
import { SlotsService } from './slots.service';
import { SlotsController } from './slots.controller';
import { TeachersModule } from '../teachers/teachers.module';
import { SubjectList, SubjectSchema } from '../subjects/schema/subject.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Slot.name, schema: SlotSchema },
      { name: SubjectList.name, schema: SubjectSchema }
    ]),
    TeachersModule,
  ],
  providers: [SlotsService],
  controllers: [SlotsController],
  exports: [SlotsService, MongooseModule],
})
export class SlotsModule { }
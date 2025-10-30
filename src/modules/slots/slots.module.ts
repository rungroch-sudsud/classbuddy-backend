import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Slot, SlotSchema } from './schemas/slot.schema';
import { SlotsService } from './slots.service';
import { SlotsController } from './slots.controller';
import { SubjectList, SubjectSchema } from '../subjects/schemas/subject.schema';
import { Wallet, WalletSchema } from '../payments/schemas/wallet.schema';
import { Teacher, TeacherSchema } from '../teachers/schemas/teacher.schema';
import { Booking, BookingSchema } from '../booking/schemas/booking.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Slot.name, schema: SlotSchema },
      { name: SubjectList.name, schema: SubjectSchema },
      { name: Wallet.name, schema: WalletSchema },
      { name: Teacher.name, schema: TeacherSchema },
      { name: Booking.name, schema: BookingSchema }
    ]),
  ],
  providers: [SlotsService],
  controllers: [SlotsController],
  exports: [SlotsService, MongooseModule],
})
export class SlotsModule { }
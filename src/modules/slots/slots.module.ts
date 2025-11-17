import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Slot, SlotSchema } from './schemas/slot.schema';
import { SlotsService } from './slots.service';
import { SlotsController } from './slots.controller';
import { SubjectList, SubjectSchema } from '../subjects/schemas/subject.schema';
import { Wallet, WalletSchema } from '../payments/schemas/wallet.schema';
import { Teacher, TeacherSchema } from '../teachers/schemas/teacher.schema';
import { Booking, BookingSchema } from '../booking/schemas/booking.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { SocketService } from '../socket/socket.service';
import { SocketGateway } from '../socket/socket.gateway';
import { JwtService } from '@nestjs/jwt';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Slot.name, schema: SlotSchema },
            { name: SubjectList.name, schema: SubjectSchema },
            { name: Wallet.name, schema: WalletSchema },
            { name: Teacher.name, schema: TeacherSchema },
            { name: Booking.name, schema: BookingSchema },
            { name: User.name, schema: UserSchema },
        ]),
    ],
    providers: [JwtService, SocketGateway, SocketService, SlotsService],
    controllers: [SlotsController],
    exports: [SlotsService, MongooseModule],
})
export class SlotsModule {}

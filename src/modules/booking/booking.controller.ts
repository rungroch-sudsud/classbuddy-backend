import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    UseGuards
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiParam,
    ApiTags
} from '@nestjs/swagger';
import { CurrentUser } from 'src/shared/utils/currentUser';
import { JwtGuard } from '../auth/guard/auth.guard';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './schemas/booking.zod.schema';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@ApiTags('Booking')
@ApiBearerAuth()

@Controller('booking')
@UseGuards(JwtGuard)
export class BookingController {
    constructor(
        @InjectQueue('booking') private bookingQueue : Queue,
        private readonly bookingService: BookingService,
    ) { }


    @Post(':slotId')
    @ApiParam({
        name: 'slotId',
        description: 'slot id ที่ต้องการจอง',
    })
    @UseGuards(JwtGuard)
    async CreatebookingSlot(
        @Param('slotId') slotId: string,
        @CurrentUser() studentId: string,
        @Body() body: CreateBookingDto
    ) {
        const booking = await this.bookingService.CreatebookingSlot(
            slotId,
            studentId,
            body
        );

        console.log('booking', booking)

        return {
            message: 'จองตารางเรียนสำเร็จ',
            data: booking,
        };
    }


    @Get('mine')
    async getMySlots(@CurrentUser() userId: string) {
        const data = await this.bookingService.getMySlot(userId);

        return {
            message: 'ดึงตารางเรียนของฉันสำเร็จ',
            data: data,
        };
    }

    @ApiOperation({ summary: 'ดึงตารางเรียนของฉันที่ผ่านมา' })
    @Get('history')
    async getHistoryBookingMine(@CurrentUser() userId: string) {
        const data = await this.bookingService.getHistoryBookingMine(userId);

        return {
            message: 'ดึงประวัติการจองสำเร็จ',
            data,
        };
    }

    @Get(':bookingId')
    async getBookingById(
        @Param('bookingId') bookingId: string,
        @CurrentUser() userId: string
    ) {
        const data = await this.bookingService.getBookingById(bookingId, userId);

        return {
            message: 'ดึงข้อมูลการจองสำเร็จ',
            data: data,
        };
    }


}

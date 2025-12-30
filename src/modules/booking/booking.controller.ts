import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiParam,
    ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/shared/utils/currentUser';
import { JwtGuard } from '../auth/guard/auth.guard';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './schemas/booking.zod.schema';

@ApiTags('Booking')
@ApiBearerAuth()
@Controller('booking')
@UseGuards(JwtGuard)
export class BookingController {
    constructor(private readonly bookingService: BookingService) {}

    @Post('ask-confirmation')
    @ApiParam({
        name: 'body',
        description: 'body ที่ต้องการจอง',
    })
    @UseGuards(JwtGuard)
    async askForBookingConfirmation(
        @CurrentUser() studentId: string,
        @Body() body: CreateBookingDto,
    ) {
        const booking = await this.bookingService.askForBookingConfirmation(
            studentId,
            body,
        );

        return {
            message: 'จองตารางเรียนสำเร็จ',
            data: booking,
        };
    }

    @Patch(':bookingId/confirm')
    @UseGuards(JwtGuard)
    async confirmBooking(
        @CurrentUser() studentId: string,
        @Param('bookingId') bookingId: string,
    ) {
        const updatedBooking = await this.bookingService.confirmBooking(bookingId);

        return {
            message: 'จองตารางเรียนสำเร็จ',
            data: updatedBooking,
        };
    }

    @Patch(':bookingId/cancel')
    @ApiParam({
        name: 'bookingId',
        description: 'bookingId ที่ต้องการยกเลิก',
    })
    @UseGuards(JwtGuard)
    async cancelBooking(
        @Param('bookingId') bookingId: string,
        @CurrentUser() currentUserId: string,
    ) {
        await this.bookingService.cancelBooking(bookingId, currentUserId);

        return {
            message: 'ยกเลิกการจองสำเร็จ',
            data: null,
        };
    }

    @Get('mine')
    async getMyStudentBookings(@CurrentUser() userId: string) {
        const data = await this.bookingService.getMyStudentBookings(userId);

        return {
            message: 'ดึงตารางเรียนของฉันสำเร็จ',
            data: data,
        };
    }

    @Get('mine/included')
    async getAnyBookingHavingMyUserId(@CurrentUser() userId: string) {
        const data =
            await this.bookingService.getAnyBookingHavingMyUserId(userId);

        return {
            message: 'ดึงตารางที่มี id ของฉันเกียวข้องสำเร็จ',
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
        @CurrentUser() userId: string,
    ) {
        const data = await this.bookingService.getBookingById(
            bookingId,
            userId,
        );

        return {
            message: 'ดึงข้อมูลการจองสำเร็จ',
            data: data,
        };
    }
}

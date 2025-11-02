import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UploadedFiles, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags, ApiParam } from '@nestjs/swagger';
import { JwtGuard } from '../auth/guard/auth.guard';
import { CurrentUser } from 'src/shared/utils/currentUser';

import { BookingService } from './booking.service';



@ApiTags('Booking')
@ApiBearerAuth()

@Controller('booking')
@UseGuards(JwtGuard)
export class BookingController {
    constructor(
        private readonly bookingService: BookingService
    ) { }


    @ApiParam({
        name: 'slotId',
        description: 'slot id ที่ต้องการจอง',
    })
    @Post(':slotId')
    @UseGuards(JwtGuard)
    async CreatebookingSlot(
        @Param('slotId') slotId: string,
        @CurrentUser() studentId: string,
    ) {
        const booking = await this.bookingService.CreatebookingSlot(slotId, studentId,);

        return {
            message: 'จองตารางเรียนสำเร็จ',
            data: booking,
        };
    }

    @ApiOperation({ summary: 'ดึงตารางเรียนของฉัน' })
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

    // @Post(':teacherId')
    // async createBooking(
    //     @CurrentUser() userId: string,
    //     @Param('teacherId') teacherId: string,
    //     @Body() body: CreateBookingDto
    // ) {
    //     const create = await this.bookingService.createBooking(
    //         userId,
    //         teacherId,
    //         body
    //     );

    //     return {
    //         message: 'ส่งคำขอสำเร็จ',
    //         data: create,
    //     };
    // }


    // @Patch('teacher/:bookingId/approve')
    // async approveBooking(
    //     @CurrentUser() teacherId: string,
    //     @Param('bookingId') bookingId: string,
    // ) {
    //     const result = await this.bookingService.updateBookingStatus(
    //         teacherId,
    //         bookingId,
    //         'approved',
    //     );
    //     return {
    //         message: 'อนุมัติการจองสำเร็จ',
    //         data: result,
    //     };
    // }

    // @Patch('teacher/:bookingId/reject')
    // async rejectBooking(
    //     @Param('bookingId') bookingId: string,
    //     @CurrentUser() userId: string,
    // ) {
    //     const result = await this.bookingService.updateBookingStatus(
    //         userId,
    //         bookingId,
    //         'rejected',
    //     );
    //     return {
    //         message: 'ปฏิเสธการจองสำเร็จ',
    //         data: result,
    //     };
    // }


}

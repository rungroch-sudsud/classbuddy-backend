import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UploadedFiles, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/strategies/auth.guard';
import { CurrentUser } from 'src/shared/utils/currentUser';

import { UploadInterceptor } from 'src/shared/interceptors/upload.interceptor';
import { ZodFilePipe, ZodFilesPipe } from 'src/shared/validators/zod.validation.pipe';
import { UploadFileDto, UploadFilesDto } from 'src/shared/docs/upload.file.docs';
import { FilesSchema, ImageFileSchema } from 'src/shared/validators/zod.schema';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './schemas/booking.zod.schema';


@ApiTags('Booking')
@ApiBearerAuth()
@Controller('booking')
export class BookingController {
    constructor(
        private readonly bookingService: BookingService
    ) { }


    // @Post(':slotId')
    // @UseGuards(JwtGuard)
    // async book(
    //     @Param('slotId') slotId: string,
    //     @CurrentUser() studentId: string,
    // ) {
    //     const booking = await this.bookingService.bookSlot(slotId, studentId,);

    //     return {
    //         message: 'Booking successfully',
    //         data: booking,
    //     };
    // }

    @Get('mine')
    @UseGuards(JwtGuard)
    async getMySlots(@CurrentUser() userId: string) {
        const slot = await this.bookingService.getMySlot(userId);

        return {
            message: 'ดึงตารางเรียนของฉันสำเร็จ',
            data: slot,
        };
    }

    @Get(':bookingId')
    @UseGuards(JwtGuard)
    async getBookingById(
        @Param('bookingId') bookingId: string,
        @CurrentUser() userId: string
    ) {
        const find = await this.bookingService.getBookingById(bookingId, userId);

        return {
            message: 'ดึงข้อมูลการจองสำเร็จ',
            data: find,
        };
    }

    @Post(':teacherId')
    @UseGuards(JwtGuard)
    async createBooking(
        @CurrentUser() userId: string,
        @Param('teacherId') teacherId: string,
        @Body() body: CreateBookingDto
    ) {
        const create = await this.bookingService.createBooking(
            userId,
            teacherId,
            body
        );

        return {
            message: 'ส่งคำขอสำเร็จ',
            data: create,
        };
    }


    @Patch('teacher/:bookingId/approve')
    @UseGuards(JwtGuard)
    async approveBooking(
        @CurrentUser() teacherId: string,
        @Param('bookingId') bookingId: string,
    ) {
        const result = await this.bookingService.updateBookingStatus(
            teacherId,
            bookingId,
            'approved',
        );
        return {
            message: 'อนุมัติการจองสำเร็จ',
            data: result,
        };
    }

    @Patch('teacher/:bookingId/reject')
    @UseGuards(JwtGuard)
    async rejectBooking(
        @Param('bookingId') bookingId: string,
        @CurrentUser() userId: string,
    ) {
        const result = await this.bookingService.updateBookingStatus(
            userId,
            bookingId,
            'rejected',
        );
        return {
            message: 'ปฏิเสธการจองสำเร็จ',
            data: result,
        };
    }


}

import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UploadedFiles, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger';
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


    @Post(':slotId')
    @UseGuards(JwtGuard)
    async book(
        @Param('slotId') slotId: string,
        @CurrentUser() studentId: string,
    ) {
        const booking = await this.bookingService.bookSlot(slotId, studentId,);

        return {
            message: 'Booking successfully',
            data: booking,
        };
    }

    @UseGuards(JwtGuard)
    @Get('mine')
    async getMySlots(@CurrentUser() userId: string) {
        const slot = await this.bookingService.getMySlot(userId);

        return {
            message: 'ดึงตารางเรียนของฉันสำเร็จ',
            data: slot,
        };
    }

}

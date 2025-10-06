import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UploadedFiles, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/strategies/auth.guard';
import { CurrentUser } from 'src/shared/utils/currentUser';

import { UploadInterceptor } from 'src/shared/interceptors/upload.interceptor';
import { ZodFilePipe, ZodFilesPipe } from 'src/shared/validators/zod.validation.pipe';
import { UploadFileDto, UploadFilesDto } from 'src/shared/docs/upload.file.docs';
import { FilesSchema, ImageFileSchema } from 'src/shared/validators/zod.schema';
import { BookingService } from './booking.service';


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
        @Body() body:string
    ) {
        return this.bookingService.bookSlot(slotId, studentId, body);
    }



}

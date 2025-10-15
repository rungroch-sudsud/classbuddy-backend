import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UploadedFiles, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/strategies/auth.guard';
import { CurrentUser } from 'src/shared/utils/currentUser';

import { UploadInterceptor } from 'src/shared/interceptors/upload.interceptor';
import { ZodFilePipe, ZodFilesPipe } from 'src/shared/validators/zod.validation.pipe';
import { UploadFileDto, UploadFilesDto } from 'src/shared/docs/upload.file.docs';
import { FilesSchema, ImageFileSchema } from 'src/shared/validators/zod.schema';
import { PaymentsService } from './payments.service';




@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
    constructor(
        private readonly paymentsService: PaymentsService
    ) { }


    @Post('booking/:bookingId')
    @UseGuards(JwtGuard)
    async createPayCharge(
        @CurrentUser() userId: string,
        @Param('bookingId') bookingId: string
    ) {
        const create = await this.paymentsService.createPromptPayCharge(
            userId, bookingId
        )

        return {
            message: 'Create payment successfully',
            data: create,
        };
    }


    @Post('payout')
    @UseGuards(JwtGuard)
    async payoutTeachers() {
        return this.paymentsService.payoutTeachers();
    }



}

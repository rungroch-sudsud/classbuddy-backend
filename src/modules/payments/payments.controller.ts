import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UploadedFiles, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/guard/auth.guard';
import { CurrentUser } from 'src/shared/utils/currentUser';
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
        @Param('bookingId') bookingId: string,
        @CurrentUser() userId: string,
    ) {
        const create = await this.paymentsService.createPromptPayCharge(
            bookingId,
            userId
        )

        return {
            message: 'สร้างการชำระเงินสำเร็จ',
            data: create,
        };
    }


    @Post('payout')
    @UseGuards(JwtGuard)
    async payoutTeachers() {
        const result = await this.paymentsService.payoutTeachers();

        return result
    }


    @Get('history/mine')
    @ApiOperation({ summary: 'ประวัติการจ่ายเงิน / การเรียน' })
    @UseGuards(JwtGuard)
    async paymentsHistory(@CurrentUser() userId: string) {
        const result = await this.paymentsService.paymentsHistory(
            userId
        );

        return {
            message: 'ดึงประวัติการชำระเงินของฉันสำเร็จ',
            data: result
        }

    }



}

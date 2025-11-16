import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/shared/utils/currentUser';
import { JwtGuard } from '../auth/guard/auth.guard';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) {}

    @Post('booking/:bookingId')
    @UseGuards(JwtGuard)
    async createPayCharge(
        @Param('bookingId') bookingId: string,
        @CurrentUser() userId: string,
    ) {
        const create = await this.paymentsService.createPromptPayCharge(
            bookingId,
            userId,
        );

        return {
            message: 'สร้างการชำระเงินสำเร็จ',
            data: create,
        };
    }

    @Post('booking/:bookingId/wallet')
    @ApiOperation({ summary: 'ชำระค่าคลาสเรียนด้วย Wallet ของ User' })
    @UseGuards(JwtGuard)
    async payBookingWithWallet(
        @Param('bookingId') bookingId: string,
        @CurrentUser() userId: string,
    ) {
        const create = await this.paymentsService.payBookingWithWallet(
            bookingId,
            userId,
        );

        return {
            message: 'สร้างการชำระเงินสำเร็จ',
            data: create,
        };
    }

    @Post('payout')
    @UseGuards(JwtGuard)
    async payoutTeachers() {
        const result = await this.paymentsService.payoutTeachers();

        return result;
    }

    @Get('history/mine')
    @ApiOperation({ summary: 'ประวัติการจ่ายเงิน / การเรียน' })
    @UseGuards(JwtGuard)
    async paymentsHistory(@CurrentUser() userId: string) {
        const result = await this.paymentsService.paymentsHistory(userId);

        return {
            message: 'ดึงประวัติการชำระเงินของฉันสำเร็จ',
            data: result,
        };
    }
}

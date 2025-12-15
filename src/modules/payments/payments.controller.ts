import {
    Controller,
    Get,
    Param,
    Post,
    Query,
    UploadedFile,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/shared/utils/currentUser';
import { JwtGuard } from '../auth/guard/auth.guard';
import { PaymentsService } from './payments.service';
import { EasySlipService } from './easy-slip.service';
import { ZodFilePipe } from 'src/shared/validators/zod.validation.pipe';
import { ImageFileSchema } from 'src/shared/validators/zod.schema';
import { UploadInterceptor } from 'src/shared/interceptors/upload.interceptor';
import { PaymentMethod } from './schemas/payment.schema';
import { Throttle } from '@nestjs/throttler';
import { businessConfig } from 'src/configs/business.config';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
    constructor(
        private readonly paymentsService: PaymentsService,
        private readonly easySlipService: EasySlipService,
    ) {}

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
        const create = await this.paymentsService.pay(
            PaymentMethod.WALLET,
            bookingId,
            userId,
        );

        return {
            message: 'สร้างการชำระเงินสำเร็จ',
            data: create,
        };
    }

    // @Throttle({
    //     default: {
    //         limit: businessConfig.payments.maxBankTransferRetries,
    //         ttl: businessConfig.payments.maxBankTransferTTL,
    //     },
    // })
    @Post('booking/:bookingId/bank-transfer')
    @ApiOperation({
        summary: 'ชำระค่าคลาสเรียนด้วยการโอนเงินผ่าน ธนาคาร และ ตรวจสลิป',
    })
    @UseGuards(JwtGuard)
    @UploadInterceptor('receiptFile', 1, 10)
    async payBookingWithBankTransfer(
        @CurrentUser() userId: string,
        @Param('bookingId') bookingId: string,
        @UploadedFile()
        receiptFile: Express.Multer.File,
    ) {
        await this.paymentsService.pay(
            PaymentMethod.BANK_TRANSFER,
            bookingId,
            userId,
            receiptFile,
        );

        return {
            message: 'ชำระเงินสำเร็จ',
            data: null,
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

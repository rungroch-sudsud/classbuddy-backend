import { InjectQueue } from '@nestjs/bullmq';
import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Connection, Model, Types } from 'mongoose';
import { Booking } from '../booking/schemas/booking.schema';
import { Teacher } from '../teachers/schemas/teacher.schema';
import { User } from '../users/schemas/user.schema';
import {
    Payment,
    PaymentMethod,
    PaymentStatus,
    PaymentType,
} from './schemas/payment.schema';
import { PayoutLog } from './schemas/payout.schema';
import { Wallet } from './schemas/wallet.schema';
import { PaymentStrategyFactory } from './strategies/payment-strategy.factory';
import { SmsService } from 'src/infra/sms/sms.service';

const Omise = require('omise');

@Injectable()
export class PaymentsService {
    private omise: any;

    constructor(
        @InjectConnection() private readonly connection: Connection,
        @InjectModel(Payment.name) private paymentModel: Model<any>,
        @InjectModel(Wallet.name) private walletModel: Model<Wallet>,
        @InjectModel(User.name) private userModel: Model<any>,
        @InjectModel(Teacher.name) private teacherModel: Model<any>,
        @InjectModel(Booking.name) private bookingModel: Model<Booking>,
        @InjectModel(PayoutLog.name) private payoutLogModel: Model<any>,
        @InjectQueue('payout') private PayoutQueue: Queue,
        private readonly strategyFactory: PaymentStrategyFactory,
        private readonly smsService: SmsService,
    ) {
        const secretKey = process.env.OMISE_SECRET_KEY;
        const publicKey = process.env.OMISE_PUBLIC_KEY;
        this.omise = Omise({ secretKey, publicKey });
    }

    async createPromptPayCharge(
        bookingId: string,
        userId: string,
    ): Promise<any> {
        const userObjId = new Types.ObjectId(userId);
        const bookingObjId = new Types.ObjectId(bookingId);

        const booking = await this.bookingModel.findById(bookingId);
        if (!booking) throw new NotFoundException('ไม่เจอเลข booking');

        if (booking.studentId.toString() !== userId) {
            throw new BadRequestException('คุณไม่มีสิทธิ์ชำระเงิน');
        }

        if (booking.status !== 'pending') {
            throw new BadRequestException(
                'ไม่สามารถชำระเงินได้เนื่องจากหมดเวลาชำระเงินหรือสถานะไม่ถูกต้อง',
            );
        }

        const user = await this.userModel.findById(userObjId);
        if (!user) throw new NotFoundException('ไม่พบผู้ใช้');

        const existingPayment = await this.paymentModel.findOne({
            bookingId: bookingObjId,
            status: PaymentStatus.PENDING,
        });

        if (existingPayment) {
            const charge =
                existingPayment.raw ??
                (await this.omise.charges.retrieve(existingPayment.chargeId));

            const qr = charge?.source?.scannable_code;
            return {
                paymentId: existingPayment._id,
                chargeId: charge.id,
                amount: existingPayment.amount,
                qrImageUrl: qr?.image?.download_uri ?? qr?.image?.uri ?? null,
                expiresAt: qr?.expires_at ?? charge.expires_at ?? null,
                status: charge.status ?? existingPayment.status,
                reused: true,
            };
        }

        const amountTHB = booking.price;
        if (!amountTHB || amountTHB <= 0) {
            throw new BadRequestException({
                error: 'INVALID_AMOUNT',
                message: 'ยอดเงินไม่ถูกต้อง',
            });
        }

        const source = await this.omise.sources.create({
            type: 'promptpay',
            amount: Math.round(amountTHB * 100),
            currency: 'thb',
        });

        const charge = await this.omise.charges.create({
            amount: Math.round(amountTHB * 100),
            currency: 'thb',
            source: source.id,
            metadata: { bookingId, userId },
        });

        const payment = await this.paymentModel.create({
            bookingId: bookingObjId,
            userId: userObjId,
            slotId: booking.slotId,
            amount: amountTHB,
            chargeId: charge.id,
            sourceId: source.id,
            status: charge.status ?? PaymentStatus.PENDING,
            type: PaymentType.BOOKING_PAYMENT,
            raw: charge,
        });

        await payment.save();

        const qr = charge.source?.scannable_code;
        return {
            paymentId: payment._id,
            chargeId: charge.id,
            amount: amountTHB,
            qrImageUrl: qr?.image?.download_uri ?? qr?.image?.uri ?? null,
            expiresAt: qr?.expires_at ?? charge.expires_at ?? null,
            status: charge.status,
            reused: false,
        };
    }

    async payoutTeachers() {
        const teachers = await this.teacherModel.find({
            verifyStatus: 'verified',
        }).select(`
                userId name lastName bankName recipientId 
                bankAccountNumber bankAccountName
                `);

        let queued = 0;

        for (const teacher of teachers) {
            const session = await this.connection.startSession();

            let wallet: any;
            let payoutLog: any;

            try {
                wallet = await this.walletModel.findOneAndUpdate(
                    {
                        userId: teacher._id,
                        availableBalance: { $gte: 500 },
                        lockedBalance: 0,
                    },
                    [
                        {
                            $set: {
                                lockedBalance: '$availableBalance',
                                availableBalance: 0,
                            },
                        },
                    ],
                    { new: true },
                );

                if (!wallet) {
                    console.warn(`[PayOut] Skipping ${teacher.name}`);
                    continue;
                }

                await session.withTransaction(async () => {
                    const totalAmount = wallet.lockedBalance;
                    const systemFee = Number((totalAmount * 0.22).toFixed(2));
                    const teacherAmount = Number(
                        (totalAmount - systemFee).toFixed(2),
                    );
                    const gatewayFee = 30;
                    const teacherNet = Number(
                        (teacherAmount - gatewayFee).toFixed(2),
                    );

                    [payoutLog] = await this.payoutLogModel.create(
                        [
                            {
                                teacherId: teacher._id,
                                walletId: wallet._id,
                                amount: totalAmount,
                                teacherAmount,
                                teacherNet,
                                systemFee,
                                gatewayFee,
                                status: 'pending',
                                description: `Preparing payout for ${teacher.name}`,
                            },
                        ],
                        { session },
                    );
                });

                if (wallet && payoutLog) {
                    await this.PayoutQueue.add('payout-job', {
                        recipientId: teacher.recipientId,
                        teacherId: teacher._id.toString(),
                        userId: teacher.userId,
                        walletId: wallet._id.toString(),
                        teacherNet: payoutLog.teacherNet,
                        totalAmount: wallet.lockedBalance,
                        teacherAmount: payoutLog.teacherAmount,
                        payoutLogId: payoutLog._id.toString(),
                        name: teacher.name,
                        lastName: teacher.lastName,
                        bankName: teacher.bankName,
                        bankAccountNumber: teacher.bankAccountNumber,
                        bankAccountName: teacher.bankAccountName,
                    });
                }

                queued++;
            } catch (err) {
                console.error(
                    `Failed to queue payout for ${teacher.name}:`,
                    err,
                );
            } finally {
                await session.endSession();
            }
        }
        return { queued };
    }

    async paymentsHistory(userId: string): Promise<any[]> {
        const payments = await this.paymentModel
            .find({
                userId: new Types.ObjectId(userId),
            })
            .sort({ createdAt: -1 });

        if (!payments)
            throw new NotFoundException('ยังไม่มีประวัติการชำระเงิน');

        return payments.map((p) => ({
            id: p._id,
            amount: p.amount,
            bookingId: p.bookingId,
            chargeId: p.chargeId,
            status: p.status,
            paidAt: p.createdAt,
        }));
    }

    async pay(
        method: PaymentMethod,
        bookingId: string,
        currentUserId: string,
        receiptFile: Express.Multer.File | undefined = undefined,
    ): Promise<void> {
        const strategy = this.strategyFactory.getStrategy(method);

        await strategy.pay({ bookingId, currentUserId, receiptFile });

        await this.smsService.sendSms(
            ['0611752168', '0853009999'],
            'มีนักเรียนชำระค่าเรียน 1 ท่าน',
        );
    }
}

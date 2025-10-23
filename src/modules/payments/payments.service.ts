import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Payment, PaymentStatus, PaymentType } from './schemas/payment.schema';
import { Model, Types, Connection } from 'mongoose';
import { Wallet } from './schemas/wallet.schema';
import { Booking } from '../booking/schemas/booking.schema';
import { User } from '../users/schemas/user.schema';
import { Teacher } from '../teachers/schemas/teacher.schema';
import { PayoutLog } from './schemas/payout.schema';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

const Omise = require('omise');

@Injectable()
export class PaymentsService {
    private omise: any;

    constructor(
        @InjectConnection() private readonly connection: Connection,
        @InjectModel(Payment.name) private paymentModel: Model<any>,
        @InjectModel(Wallet.name) private walletModel: Model<any>,
        @InjectModel(Booking.name) private bookingModel: Model<any>,
        @InjectModel(User.name) private userModel: Model<any>,
        @InjectModel(Teacher.name) private teacherModel: Model<any>,
        @InjectModel(PayoutLog.name) private payoutLogModel: Model<any>,
        @InjectQueue('payout') private PayoutQueue: Queue,
    ) {
        const secretKey = process.env.OMISE_SECRET_KEY;
        const publicKey = process.env.OMISE_PUBLIC_KEY;
        this.omise = Omise({ secretKey, publicKey });
    }


    async createPromptPayCharge(
        userId: string,
        bookingId: string
    ): Promise<any> {
        const booking = await this.bookingModel.findById(bookingId);
        if (!booking) throw new NotFoundException('Booking not found');

        if (booking.studentId.toString() !== userId) {
            throw new BadRequestException('You are not the owner of this booking');
        }

        if (booking.status !== 'wait_for_payment') {
            throw new BadRequestException('This booking has already been paid or cancelled');
        }

        const user = await this.userModel.findById(userId);
        if (!user) throw new NotFoundException('User not found');

        const existingPayment = await this.paymentModel.findOne({
            bookingId: new Types.ObjectId(bookingId),
            type: PaymentType.BOOKING_PAYMENT,
        });

        if (existingPayment) {
            const charge = existingPayment.raw
                ?? await this.omise.charges.retrieve(existingPayment.chargeId);

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
            bookingId: new Types.ObjectId(bookingId),
            userId: new Types.ObjectId(userId),
            amount: amountTHB,
            chargeId: charge.id,
            sourceId: source.id,
            status: charge.status ?? PaymentStatus.PENDING,
            type: PaymentType.BOOKING_PAYMENT,
            raw: charge
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
        const teachers = await this.teacherModel
            .find({ isVerified: true })
            .select(`
                userId name lastName bankName recipientId 
                bankAccountNumber bankAccountName
                `);

        let queued = 0;

        for (const teacher of teachers) {
            const session = await this.connection.startSession();

            let wallet: any;
            let payoutLog: any;

            try {
                await session.withTransaction(async () => {
                    wallet = await this.walletModel.findOneAndUpdate(
                        {
                            userId: teacher.userId,
                            availableBalance: { $gte: 500 },
                            lockedBalance: 0,
                        },
                        [
                            { $set: { lockedBalance: '$availableBalance', availableBalance: 0 } },
                        ],
                        { new: true, session },
                    );

                    if (!wallet) return;

                    const totalAmount = wallet.lockedBalance;
                    const systemFee = Number((totalAmount * 0.22).toFixed(2));
                    const teacherAmount = Number((totalAmount - systemFee).toFixed(2));

                    const gatewayFee = 30;
                    const teacherNet = Number((teacherAmount - gatewayFee).toFixed(2));


                    [payoutLog] = await this.payoutLogModel.create(
                        [{
                            teacherId: teacher._id,
                            walletId: wallet._id,
                            amount: totalAmount,
                            teacherAmount,
                            teacherNet,
                            systemFee,
                            gatewayFee,
                            status: 'pending',
                            description: `Preparing payout for ${teacher.name}`,
                        }],
                        { session },
                    );
                })

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
                    console.log(payoutLog.teacherNet)
                }

                queued++;
            } catch (err) {
                console.error(`Failed to queue payout for ${teacher.name}:`, err);
            } finally {
                await session.endSession();
            }
        }
        return { queued };
    }
}


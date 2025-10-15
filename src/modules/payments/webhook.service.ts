import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';

import { Payment, PaymentStatus, PaymentType } from './schemas/payment.schema';
import mongoose, { Model, Types, Connection } from 'mongoose';
import { Wallet } from './schemas/wallet.schema';
import { Booking } from '../booking/schemas/booking.schema';
import { User } from '../users/schemas/user.schema';
import { Teacher } from '../teachers/schemas/teacher.schema';
import { Slot } from '../slots/schemas/slot.schema';
import { PayoutLog } from './schemas/payout.schema';

const Omise = require('omise');

@Injectable()
export class WebhookService {
    private omise: any;

    constructor(
        @InjectConnection() private readonly connection: Connection,
        @InjectModel(Payment.name) private paymentModel: Model<any>,
        @InjectModel(Wallet.name) private walletModel: Model<any>,
        @InjectModel(Booking.name) private bookingModel: Model<any>,
        @InjectModel(User.name) private userModel: Model<any>,
        @InjectModel(Teacher.name) private teacherModel: Model<any>,
        @InjectModel(Slot.name) private slotModel: Model<any>,
        @InjectModel(PayoutLog.name) private payoutLogModel: Model<any>
    ) {
        const secretKey = process.env.OMISE_SECRET_KEY;
        const publicKey = process.env.OMISE_PUBLIC_KEY;
        this.omise = Omise({ secretKey, publicKey });
    }


    private async handleChargeWebhook(evt: any) {
        const chargeId = evt.data.id;
        const charge = await this.omise.charges.retrieve(chargeId);
        const status = charge.status as PaymentStatus
        const { bookingId, userId } = charge.metadata ?? {};
        const amountTHB = Math.round((charge.amount ?? 0)) / 100;

        const bookingObjId = bookingId ? new Types.ObjectId(bookingId) : null;
        const userObjId = userId ? new Types.ObjectId(userId) : null;

        const session = await this.connection.startSession();
        await session.withTransaction(async () => {

            const setNow: any = { status, raw: charge };
            if (status === 'successful') setNow.paidAt = new Date();

            const setOnInsert: any = {
                chargeId,
                sourceId: charge?.source?.id,
                bookingId: bookingObjId ?? undefined,
                userId: userObjId ?? undefined,
                amount: amountTHB,
                currency: charge?.currency ?? 'thb',
                createdAt: new Date(),
            };

            for (const key in setOnInsert) {
                if (setOnInsert[key] === undefined) delete setOnInsert[key];
            }

            await this.paymentModel.findOneAndUpdate(
                { chargeId },
                { $set: setNow, $setOnInsert: setOnInsert },
                { new: true, upsert: true, session },
            );

            if (status !== PaymentStatus.SUCCESS) {
                throw new ConflictException(`Charge ${chargeId} is currently '${status}'`);
            }

            // เติม point ให้ user
            await this.walletModel.updateOne(
                { userId: userObjId },
                { $inc: { availableBalance: amountTHB } },
                { upsert: true, session },
            );

            // ดึง booking และเช็กยอด
            const booking = await this.bookingModel.findById(bookingObjId).session(session);
            if (!booking) throw new Error('Booking not found');

            if (booking.price !== amountTHB) {
                throw new Error(`Payment amount mismatch: expected ${booking.price}, got ${amountTHB}`);
            }

            // 5. หัก point ทันทีเพื่อจ่าย booking
            const wallet = await this.walletModel.findOne({ userId: userObjId }).session(session);
            if (!wallet || wallet.availableBalance < booking.price) {
                throw new Error('Insufficient balance after topup — this should not happen');
            }

            await this.walletModel.updateOne(
                { userId: userObjId, role: 'user' },
                { $inc: { availableBalance: -booking.price } },
                { session },
            );

            // เปลี่ยน booking เป็น paid
            booking.status = 'confirmed';
            booking.paidAt = new Date();
            await booking.save({ session });

            // เปลี่ยน slot ของครูเป็น booked
            if (booking.slotId) {
                await this.slotModel.updateOne(
                    { _id: booking.slotId },
                    { $set: { status: 'booked' } },
                    { session },
                );
            }

            // เพิ่ม point ให้ pendingBalance ของ teacher
            if (booking.teacherId) {
                await this.walletModel.updateOne(
                    { userId: booking.teacherId, role: 'teacher' },
                    { $inc: { pendingBalance: booking.price } },
                    { upsert: true, session },
                );
            }
        });

        session.endSession();
    }


    private async handleTransferWebhook(evt: any) {
        const transferId = evt.data.id;
        const transfer = await this.omise.transfers.retrieve(transferId);

        const { teacherId, walletId, payoutLogId } = transfer.metadata ?? {};
        const walletObjId = walletId ? new Types.ObjectId(walletId) : null;
        const payoutLogObjId = payoutLogId ? new Types.ObjectId(payoutLogId) : null;

        let status: 'processing' | 'sent' | 'paid' | 'failed' = 'processing';
        if (evt.key === 'transfer.send') status = 'sent';
        if (evt.key === 'transfer.pay') status = 'paid';
        if (evt.key === 'transfer.fail') status = 'failed';

        await this.payoutLogModel.findOneAndUpdate(
            { _id: payoutLogObjId },
            {
                $set: {
                    transferId: transfer.id,
                    status,
                    updatedAt: new Date(),
                    ...(transfer.paid_at ? { transferredAt: new Date(transfer.paid_at) } : {}),
                },
            },
            { upsert: false },
        );

        if (status === 'paid') {
            await this.walletModel.updateOne(
                { _id: walletObjId },
                { $set: { lockedBalance: 0 } },
            );
        }

        if (status === 'failed') {
            await this.walletModel.updateOne(
                { _id: walletObjId },
                {
                    $inc: { availableBalance: (transfer.amount ?? 0) / 100 },
                    $set: { lockedBalance: 0 },
                },
            );
        }
    }


    async handleOmiseWebhook(evt: any) {
        const objectType = evt?.data.object;
        const objectId = evt?.data.id;
        console.log(`[Omise Webhook] ${evt.key} → ${objectType} (${objectId})`);

        if (!objectType || !objectId) return;
        switch (objectType) {

            case 'charge':
                await this.handleChargeWebhook(evt);
                break;
            case 'transfer':
                await this.handleTransferWebhook(evt);
                break;
            case 'recipient':
                console.log('Ignoring recipint webhook ');
                break;

            default:
                console.log('[Webhook] Recipient event received:', evt.data);
                break;
        }
    }


    // async handleOmiseWebhook(evt: any) {
    //     const key = evt?.key;
    //     const chargeId = evt?.data?.id;
    //     if (!key || !chargeId) return;

    //     const charge = await this.omise.charges.retrieve(chargeId);
    //     const status = charge.status as PaymentStatus
    //     const { bookingId, userId } = charge.metadata ?? {};
    //     const amountTHB = Math.round((charge.amount ?? 0)) / 100;

    //     const bookingObjId = bookingId ? new Types.ObjectId(bookingId) : null;
    //     const userObjId = userId ? new Types.ObjectId(userId) : null;

    //     const session = await this.connection.startSession();
    //     await session.withTransaction(async () => {

    //         const setNow: any = { status, raw: charge };
    //         if (status === 'successful') setNow.paidAt = new Date();

    //         const setOnInsert: any = {
    //             chargeId,
    //             sourceId: charge?.source?.id,
    //             bookingId: bookingObjId ?? undefined,
    //             userId: userObjId ?? undefined,
    //             amount: amountTHB,
    //             currency: charge?.currency ?? 'thb',
    //             createdAt: new Date(),
    //         };

    //         for (const key in setOnInsert) {
    //             if (setOnInsert[key] === undefined) delete setOnInsert[key];
    //         }

    //         await this.paymentModel.findOneAndUpdate(
    //             { chargeId },
    //             { $set: setNow, $setOnInsert: setOnInsert },
    //             { new: true, upsert: true, session },
    //         );

    //         if (status !== PaymentStatus.SUCCESS) {
    //             throw new ConflictException(`Charge ${chargeId} is currently '${status}'`);
    //         }

    //         // เติม point ให้ user
    //         await this.walletModel.updateOne(
    //             { userId: userObjId },
    //             { $inc: { availableBalance: amountTHB } },
    //             { upsert: true, session },
    //         );

    //         // ดึง booking และเช็กยอด
    //         const booking = await this.bookingModel.findById(bookingObjId).session(session);
    //         if (!booking) throw new Error('Booking not found');

    //         if (booking.price !== amountTHB) {
    //             throw new Error(`Payment amount mismatch: expected ${booking.price}, got ${amountTHB}`);
    //         }

    //         // 5. หัก point ทันทีเพื่อจ่าย booking
    //         const wallet = await this.walletModel.findOne({ userId: userObjId }).session(session);
    //         if (!wallet || wallet.availableBalance < booking.price) {
    //             throw new Error('Insufficient balance after topup — this should not happen');
    //         }

    //         await this.walletModel.updateOne(
    //             { userId: userObjId },
    //             { $inc: { availableBalance: -booking.price } },
    //             { session },
    //         );

    //         // เปลี่ยน booking เป็น paid
    //         booking.status = 'confirmed';
    //         booking.paidAt = new Date();
    //         await booking.save({ session });

    //         // เปลี่ยน slot ของครูเป็น booked
    //         if (booking.slotId) {
    //             await this.slotModel.updateOne(
    //                 { _id: booking.slotId },
    //                 { $set: { status: 'booked' } },
    //                 { session },
    //             );
    //         }

    //         // เพิ่ม point ให้ pendingBalance ของ teacher
    //         if (booking.teacherId) {
    //             await this.walletModel.updateOne(
    //                 { userId: booking.teacherId },
    //                 { $inc: { pendingBalance: booking.price } },
    //                 { upsert: true, session },
    //             );
    //         }
    //     });

    //     session.endSession();
    // }
}

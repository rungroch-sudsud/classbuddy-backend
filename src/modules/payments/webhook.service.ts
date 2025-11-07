import { BadRequestException, ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';

import { Payment, PaymentStatus, PaymentType } from './schemas/payment.schema';
import { Model, Types, Connection } from 'mongoose';
import { Wallet } from './schemas/wallet.schema';
import { Booking } from '../booking/schemas/booking.schema';
import { User } from '../users/schemas/user.schema';
import { Teacher } from '../teachers/schemas/teacher.schema';
import { Slot } from '../slots/schemas/slot.schema';
import { PayoutLog } from './schemas/payout.schema';
import { Notification } from '../notifications/schema/notification';
import { Role } from '../auth/role/role.enum';
import { StreamChatService } from '../chat/stream-chat.service';
import { ChatService } from '../chat/chat.service';
import { VideoService } from '../chat/video.service';

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
        @InjectModel(PayoutLog.name) private payoutLogModel: Model<any>,
        @InjectModel(Notification.name) private notificationModel: Model<any>,
        private readonly streamChatService: StreamChatService,
        private readonly chatService: ChatService,
        private readonly videoService: VideoService
    ) {
        const secretKey = process.env.OMISE_SECRET_KEY;
        const publicKey = process.env.OMISE_PUBLIC_KEY;
        this.omise = Omise({ secretKey, publicKey });
    }


    private async handleRecipientWebhook(evt: any) {
        try {
            const recipient = evt?.data;

            if (!recipient?.id) return;

            if (recipient.object !== 'recipient' || !recipient.verified) {
                return console.warn(`[OMISE WEBHOOK] Recipient ${recipient.id} ยังไม่ verified`);
            }

            const recipientId = recipient.id;
            const teacher = await this.teacherModel.findOne({ recipientId });

            if (!teacher) {
                return console.warn(`[OMISE WEBHOOK] ไม่พบ Teacher ที่มี recipientId: ${recipientId}`);
            }

            if (teacher.verifyStatus === 'verified') {
                return console.log(`[OMISE WEBHOOK] Teacher ${teacher.name} verified ไปเรียบร้อยแล้ว`);
            }

            teacher.verifyStatus = 'verified';
            teacher.verifiedAt = new Date();
            await teacher.save();

            const user = await this.userModel.findOne({ _id: teacher.userId });
            if (!user) return console.warn(`[OMISE WEBHOOK] ไม่พบ User ที่มี ${teacher.userId}`);

            user.role = Role.Teacher;
            await user.save();

            try {
                const teacherStreamId = `${user._id}`;
                await this.streamChatService.upsertUser({
                    id: teacherStreamId,
                    name: `${teacher.name ?? ''} ${teacher.lastName ?? ''}`.trim(),
                    image: user.profileImage ?? null,
                });
                console.log(`[GETSTREAM] upsert teacher ${teacherStreamId} successful`);
            } catch (err) {
                console.warn('[GETSTREAM] Failed to upsert teacher:', err.message);
            }

            await this.notificationModel.create({
                senderType: 'System',
                recipientId: teacher._id,
                recipientType: 'Teacher',
                message: 'บัญชีของคุณได้รับการยืนยันตัวตนเรียบร้อยแล้ว',
                meta: { recipientId, verifiedAt: teacher.verifiedAt },
            });

            console.log(`[OMISE WEBHOOK] ${teacher.name} ${teacher.lastName} ${teacher._id} ถูกยืนยันสำเร็จจาก Omise`);

        } catch (err) {
            console.error('[OMISE WEBHOOK] :', err);
            throw err;
        }
    }


    // private async handleChargeWebhook(evt: any) {
    //     const chargeId = evt.data.id;
    //     const charge = await this.omise.charges.retrieve(chargeId);
    //     const status = charge.status as PaymentStatus
    //     const { bookingId, userId } = charge.metadata ?? {};
    //     const amountTHB = Math.round((charge.amount ?? 0)) / 100;

    //     const bookingObjId = bookingId ? new Types.ObjectId(bookingId) : null;
    //     const userObjId = userId ? new Types.ObjectId(userId) : null;

    //     const session = await this.connection.startSession();
    //     try {
    //         await session.withTransaction(async () => {

    //             const setNow: any = { status, raw: charge };
    //             if (status === 'successful') setNow.paidAt = new Date();

    //             const setOnInsert: any = {
    //                 chargeId,
    //                 sourceId: charge?.source?.id,
    //                 bookingId: bookingObjId ?? undefined,
    //                 userId: userObjId ?? undefined,
    //                 amount: amountTHB,
    //                 currency: charge?.currency ?? 'thb',
    //                 createdAt: new Date(),
    //             };

    //             for (const key in setOnInsert) {
    //                 if (setOnInsert[key] === undefined) delete setOnInsert[key];
    //             }

    //             await this.paymentModel.findOneAndUpdate(
    //                 { chargeId },
    //                 { $set: setNow, $setOnInsert: setOnInsert },
    //                 { new: true, upsert: true, session },
    //             );

    //             // if (status !== PaymentStatus.SUCCESS) {
    //             //     return;
    //             // }

    //             // เติม point ให้ user
    //             await this.walletModel.updateOne(
    //                 { userId: userObjId },
    //                 { $inc: { availableBalance: amountTHB } },
    //                 { upsert: true, session },
    //             );

    //             // ดึง booking และเช็กยอด
    //             const booking = await this.bookingModel.findById(bookingObjId).session(session);
    //             if (!booking) throw new Error('Booking not found');

    //             if (booking.status === 'paid') return;
    //             if (booking.status !== 'wait_for_payment') {
    //                 throw new ConflictException('Booking is not awaiting payment');
    //             }
    //             if (booking.price !== amountTHB) {
    //                 throw new Error(`Payment amount mismatch: expected ${booking.price}, got ${amountTHB}`);
    //             }

    //             // 5. หัก point ทันทีเพื่อจ่าย booking
    //             const wallet = await this.walletModel.findOne({ userId: userObjId }).session(session);
    //             if (!wallet || wallet.availableBalance < booking.price) {
    //                 throw new Error('Insufficient balance after topup — this should not happen');
    //             }

    //             await this.walletModel.updateOne(
    //                 { userId: userObjId, role: Role.User },
    //                 { $inc: { availableBalance: -booking.price } },
    //                 { session },
    //             );
    //             console.log(booking.price, wallet, amountTHB)

    //             // เปลี่ยน booking เป็น paid
    //             booking.status = 'paid';
    //             booking.paidAt = new Date();
    //             await booking.save({ session });

    //             await this.slotModel.updateOne(
    //                 { bookingId: booking._id },
    //                 { $set: { status: 'paid' } },
    //                 { session },
    //             );

    //             // เพิ่ม point ให้ pendingBalance ของ teacher
    //             if (booking.teacherId) {
    //                 await this.walletModel.updateOne(
    //                     { userId: booking.teacherId, role: 'teacher' },
    //                     { $inc: { pendingBalance: booking.price } },
    //                     { upsert: true, session },
    //                 );
    //             }

    //             const start = booking.startTime instanceof Date
    //                 ? booking.startTime.toTimeString().slice(0, 5)
    //                 : booking.startTime;

    //             const end = booking.endTime instanceof Date
    //                 ? booking.endTime.toTimeString().slice(0, 5)
    //                 : booking.endTime;

    //             await this.notificationModel.create([
    //                 {
    //                     senderType: 'System',
    //                     recipientId: new Types.ObjectId(booking.studentId),
    //                     recipientType: 'User',
    //                     type: 'booking_paid',
    //                     message: `ชำระเงินสำเร็จ! คุณสามารถรอเรียนกับครูได้ในวันที่ ${booking.date} เวลา ${start} - ${end}`,
    //                     meta: {
    //                         bookingId: booking._id,
    //                         date: booking.date,
    //                         startTime: booking.startTime,
    //                         endTime: booking.endTime,
    //                         price: booking.price,
    //                     },
    //                 },
    //                 {
    //                     senderType: 'System',
    //                     recipientId: new Types.ObjectId(booking.teacherId),
    //                     recipientType: 'Teacher',
    //                     type: 'booking_paid',
    //                     message: `นักเรียนได้ชำระเงินค่าเรียนเรียบร้อยแล้ว! นัดสอนวันที่ ${booking.date} เวลา ${start} - ${end}`,
    //                     meta: {
    //                         bookingId: booking._id,
    //                         studentId: userObjId,
    //                         date: booking.date,
    //                         startTime: booking.startTime,
    //                         endTime: booking.endTime,
    //                         price: booking.price,
    //                     },
    //                 },
    //             ],
    //                 { session, ordered: true });
    //         });
    //     } catch (err) {
    //         console.error('[OmiseWebhookError]', err);
    //         throw err;
    //     } finally {
    //         await session.endSession();
    //     }
    // }

    private async handleChargeWebhook(evt: any) {
        const chargeId = evt.data.id;
        const charge = await this.omise.charges.retrieve(chargeId);
        const status = charge.status as PaymentStatus;
        const { bookingId, slotId, userId } = charge.metadata ?? {};
        const amountTHB = Math.round((charge.amount ?? 0)) / 100;

        const bookingObjId = bookingId ? new Types.ObjectId(bookingId) : null;
        const userObjId = userId ? new Types.ObjectId(userId) : null;
        // console.log(slotId)
        const session = await this.connection.startSession();
        try {
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

                // 1️⃣ บันทึกข้อมูลการชำระเงิน
                await this.paymentModel.findOneAndUpdate(
                    { chargeId },
                    { $set: setNow, $setOnInsert: setOnInsert },
                    { new: true, upsert: true, session },
                );

                if (status !== PaymentStatus.SUCCESS) {
                    console.log(`[OMISE WEBHOOK] Payment ${chargeId} ยังไม่สำเร็จ status: ${status}`);
                    return;
                }

                // 2️⃣ เติมเงินเข้ากระเป๋า (top up)
                await this.walletModel.updateOne(
                    { userId: userObjId, role: Role.User },
                    { $inc: { availableBalance: amountTHB } },
                    { upsert: true, session },
                );

                // ดึง wallet ที่เพิ่งเติมมาใช้ต่อทันทีใน transaction เดียวกัน
                const wallet = await this.walletModel
                    .findOne({ userId: userObjId, role: Role.User })
                    .session(session);

                if (!wallet) throw new Error(`ไม่พบกระเป๋าเงินของ ${userObjId}`);

                // 3️⃣ ตรวจ booking
                const booking = await this.bookingModel
                    .findById(bookingObjId)
                    .session(session);

                if (!booking) throw new Error('Booking id ไม่ถูกต้อง');
                if (booking.status === 'paid') return;

                if (booking.status !== 'pending') {
                    throw new ConflictException('Booking is not awaiting payment');
                }

                if (booking.price !== amountTHB) {
                    throw new Error(`ยอดเงินไม่ถูกต้องไม่ควรเกิดขึ้น ${booking.price} ได้รับ ${amountTHB}`);
                }

                // 4️⃣ ตรวจยอดเงินคงเหลือ
                if (wallet.availableBalance < booking.price) {
                    throw new Error('ยอดเงินไม่ถูกต้องไม่ควรเกิดขึ้น');
                }

                // 5️⃣ หักยอดจาก wallet (หักจากตัวแปร wallet ที่เพิ่ง query ได้)
                wallet.availableBalance -= booking.price;
                await wallet.save({ session });

                // 6️⃣ เปลี่ยน booking เป็น paid
                booking.status = 'paid';
                booking.paidAt = new Date();
                await booking.save({ session });

                // 7️⃣ อัปเดต slot เป็น paid
                await this.slotModel.updateOne(
                    { bookingId: booking._id },
                    { $set: { status: 'paid' } },
                    { session },
                );

                // 8️⃣ เพิ่ม point ให้ pendingBalance ของ teacher
                if (booking.teacherId) {
                    await this.walletModel.updateOne(
                        { userId: booking.teacherId, role: Role.Teacher },
                        { $inc: { pendingBalance: booking.price } },
                        { upsert: true, session },
                    );
                }

                try {
                    const teacher = await this.teacherModel
                        .findById(booking.teacherId)
                        .lean<Teacher & { userId: Types.ObjectId }>();

                    if (!teacher) throw new Error(`[WEBHOOK] Teacher not found for ${booking.teacherId}`);

                    await this.chatService.createOrGetChannel(
                        booking.studentId.toString(),
                        teacher.userId.toString(),
                    );

                    await this.videoService.createCallRoom(booking._id.toString());

                    console.log(`[GETSTREAM] Created chat channel for booking ${booking._id}`);
                    console.log(`[STREAM VIDEO] Created video call room for booking ${booking._id}`);

                } catch (err) {
                    console.warn('[GETSTREAM] Failed to create channel:', err.message);
                }

                // 9️⃣ แจ้งเตือนทั้งนักเรียนและครู
                const start = booking.startTime instanceof Date
                    ? booking.startTime.toTimeString().slice(0, 5)
                    : booking.startTime;
                const end = booking.endTime instanceof Date
                    ? booking.endTime.toTimeString().slice(0, 5)
                    : booking.endTime;

                await this.notificationModel.create([
                    {
                        senderType: 'System',
                        recipientId: new Types.ObjectId(booking.studentId),
                        recipientType: 'User',
                        type: 'booking_paid',
                        message: `ชำระเงินสำเร็จ! คุณสามารถรอเรียนกับครูได้ในวันที่ ${booking.date} เวลา ${start} - ${end}`,
                        meta: {
                            bookingId: booking._id,
                            date: booking.date,
                            startTime: booking.startTime,
                            endTime: booking.endTime,
                            price: booking.price,
                        },
                    },
                    {
                        senderType: 'System',
                        recipientId: new Types.ObjectId(booking.teacherId),
                        recipientType: 'Teacher',
                        type: 'booking_paid',
                        message: `นักเรียนได้ชำระเงินค่าเรียนเรียบร้อยแล้ว! นัดสอนวันที่ ${booking.date} เวลา ${start} - ${end}`,
                        meta: {
                            bookingId: booking._id,
                            studentId: userObjId,
                            date: booking.date,
                            startTime: booking.startTime,
                            endTime: booking.endTime,
                            price: booking.price,
                        },
                    },
                ], { session, ordered: true });
            });
        } catch (err) {
            console.error('[OMISE WEBHOOK]', err);
            throw err;
        } finally {
            await session.endSession();
        }
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
        try {
            const objectType = evt?.data.object;
            const objectId = evt?.data.id;
            console.log(`[OMISE WEBHOOK] ${evt.key} → ${objectType} (${objectId})`);

            if (!objectType || !objectId) {
                console.warn('[OMISE WEBHOOK] Missing object info:', evt);
                return;
            }

            switch (objectType) {

                case 'charge':
                    await this.handleChargeWebhook(evt);
                    break;
                case 'transfer':
                    await this.handleTransferWebhook(evt);
                    break;
                case 'recipient':
                    await this.handleRecipientWebhook(evt);
                    break;
                default:
                    console.log('[OMISE WEBHOOK] Recipient event received:', evt.data);
                    break;
            }

        } catch (err) {
            console.error('[OMISE WEBHOOK] Error processing :', err);
            throw new InternalServerErrorException('Webhook processing error');
        }
    }

}

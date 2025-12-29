import {
    ConflictException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';

import { Connection, Model, Types } from 'mongoose';
import { envConfig } from 'src/configs/env.config';
import { EmailService } from 'src/infra/email/email.service';
import { EmailTemplateID } from 'src/infra/email/email.type';
import { SmsService } from 'src/infra/sms/sms.service';
import { createObjectId, infoLog } from 'src/shared/utils/shared.util';
import { Role } from '../auth/role/role.enum';
import { Booking } from '../booking/schemas/booking.schema';
import { ChatService } from '../chat/chat.service';
import { StreamChatService } from '../chat/stream-chat.service';
import { VideoService } from '../chat/video.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Slot } from '../slots/schemas/slot.schema';
import { Teacher } from '../teachers/schemas/teacher.schema';
import { User } from '../users/schemas/user.schema';
import { Payment, PaymentStatus } from './schemas/payment.schema';
import { PayoutLog } from './schemas/payout.schema';
import { Wallet } from './schemas/wallet.schema';
import { SocketService } from '../socket/socket.service';
import { SocketEvent } from 'src/shared/enums/socket.enum';

const Omise = require('omise');

@Injectable()
export class WebhookService {
    private omise: any;

    constructor(
        @InjectConnection() private readonly connection: Connection,
        @InjectModel(Payment.name) private paymentModel: Model<any>,
        @InjectModel(Wallet.name) private walletModel: Model<any>,
        @InjectModel(Booking.name) private bookingModel: Model<any>,
        @InjectModel(User.name) private userModel: Model<User>,
        @InjectModel(Teacher.name) private teacherModel: Model<any>,
        @InjectModel(Slot.name) private slotModel: Model<any>,
        @InjectModel(PayoutLog.name) private payoutLogModel: Model<any>,
        private readonly notificationService: NotificationsService,
        private readonly smsService: SmsService,
        private readonly streamChatService: StreamChatService,
        private readonly chatService: ChatService,
        private readonly videoService: VideoService,
        private readonly emailService: EmailService,
        private readonly socketService: SocketService,
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
                return console.warn(
                    `[OMISE WEBHOOK] Recipient ${recipient.id} ยังไม่ verified`,
                );
            }

            const recipientId = recipient.id;
            const teacher = await this.teacherModel.findOne({ recipientId });

            if (!teacher) {
                return console.warn(
                    `[OMISE WEBHOOK] ไม่พบ Teacher ที่มี recipientId: ${recipientId}`,
                );
            }

            if (teacher.verifyStatus === 'verified') {
                return console.log(
                    `[OMISE WEBHOOK] Teacher ${teacher.name} verified ไปเรียบร้อยแล้ว`,
                );
            }

            teacher.verifyStatus = 'verified';
            teacher.verifiedAt = new Date();
            await teacher.save();

            const user = await this.userModel.findOne({ _id: teacher.userId });
            if (!user)
                return console.warn(
                    `[OMISE WEBHOOK] ไม่พบ User ที่มี ${teacher.userId}`,
                );

            user.role = Role.Teacher;
            await user.save();

            try {
                const teacherStreamId = `${user._id}`;
                await this.streamChatService.upsertUser({
                    id: teacherStreamId,
                    name: `${teacher.name ?? ''} ${teacher.lastName ?? ''}`.trim(),
                    image: user.profileImage ?? '',
                });
                console.log(
                    `[GETSTREAM] upsert teacher ${teacherStreamId} successful`,
                );
            } catch (err) {
                console.warn(
                    '[GETSTREAM] Failed to upsert teacher:',
                    err.message,
                );
            }

            await this.notificationService.sendNotification(teacher.userId, {
                recipientType: 'Teacher',
                message: `บัญชีของคุณได้รับการยืนยันตัวตนเรียบร้อยแล้ว`,
                type: 'booking_paid',
                meta: { recipientId, verifiedAt: teacher.verifiedAt },
            });

            console.log(
                `[OMISE WEBHOOK] ${teacher.name} ${teacher.lastName} ${teacher._id} ถูกยืนยันสำเร็จจาก Omise`,
            );
        } catch (err) {
            console.error('[OMISE WEBHOOK] :', err);
            throw err;
        }
    }

    private async handleChargeWebhook(evt: any) {
        const chargeId = evt.data.id;
        const charge = await this.omise.charges.retrieve(chargeId);
        const status = charge.status as PaymentStatus;
        const { bookingId, userId } = charge.metadata ?? {};
        const amountTHB = Math.round(charge.amount ?? 0) / 100;

        const bookingObjId = bookingId && new Types.ObjectId(bookingId);
        const userObjId = userId && new Types.ObjectId(userId);

        const session = await this.connection.startSession();

        let postProcess: {
            bookingId?: string;
            teacherId?: string;
            studentId?: string;
        } = {};

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

                // 1️⃣ บันทึกข้อมูลการชำระเงิน
                await this.paymentModel.findOneAndUpdate(
                    { chargeId },
                    { $set: setNow, $setOnInsert: setOnInsert },
                    { new: true, upsert: true, session },
                );

                if (status !== PaymentStatus.SUCCESS) return;

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

                if (!wallet)
                    throw new Error(`ไม่พบกระเป๋าเงินของ ${userObjId}`);

                // 3️⃣ ตรวจ booking
                const booking = await this.bookingModel
                    .findById(bookingObjId)
                    .session(session);

                if (!booking) throw new Error('Booking id ไม่ถูกต้อง');
                if (booking.status === 'paid') return;

                if (booking.status !== 'pending') {
                    throw new ConflictException(
                        'Booking is not awaiting payment',
                    );
                }

                if (booking.price !== amountTHB) {
                    throw new Error(
                        `ยอดเงินไม่ถูกต้องไม่ควรเกิดขึ้น ${booking.price} ได้รับ ${amountTHB}`,
                    );
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
                    { $set: { status: 'paid', paidAt: new Date() } },
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

                postProcess = {
                    bookingId: booking._id.toString(),
                    teacherId: booking.teacherId?.toString(),
                    studentId: booking.studentId?.toString(),
                };
            });

            if (
                postProcess.bookingId &&
                postProcess.teacherId &&
                postProcess.studentId
            ) {
                try {
                    const teacher = await this.teacherModel
                        .findById(postProcess.teacherId)
                        .populate('user')
                        .lean<
                            Teacher & { userId: Types.ObjectId; user: User }
                        >();

                    if (!teacher) {
                        throw new Error(
                            `[WEBHOOK] Teacher not found for ${postProcess.teacherId}`,
                        );
                    }

                    await this.chatService.createOrGetChannel(
                        postProcess.studentId.toString(),
                        teacher.userId.toString(),
                    );

                    await this.videoService.createCallRoom(
                        postProcess.bookingId,
                    );
                    console.log(
                        `[STREAM VIDEO] Created video call room for booking ${postProcess.bookingId}`,
                    );

                    await this.notificationService.sendNotification(
                        postProcess.studentId,
                        {
                            recipientType: 'User',
                            message: `ชำระเงินสำเร็จแล้ว 🎉 สามารถตรวจสอบตารางเรียนของคุณได้ที่ตารางของฉัน`,
                            type: 'booking_paid',
                            // meta: { bookingId: postProcess.bookingId },
                        },
                    );

                    await this.notificationService.sendNotification(
                        teacher.userId.toString(),
                        {
                            recipientType: 'Teacher',
                            message: `มีนักเรียนจองตารางเรียนกับคุณแล้ว ✨ ตรวจสอบรายละเอียดการสอน`,
                            type: 'booking_paid',
                            // meta: { bookingId: postProcess.bookingId },
                        },
                    );

                    const teacherEmail = teacher.user.email;

                    if (teacherEmail) {
                        await this.emailService.sendEmail({
                            mail_to: { email: teacherEmail },
                            subject: 'การชำระเงิน',
                            payload: {
                                CHAT_URL: `${envConfig.frontEndUrl}/chat`,
                            },
                            template_uuid: EmailTemplateID.SUCCESSFUL_PAYMENT,
                        });
                    }
                } catch (err) {
                    console.warn(
                        '[GETSTREAM] Failed to create channel:',
                        err.message,
                    );
                }
            }
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
        const payoutLogObjId = payoutLogId
            ? new Types.ObjectId(payoutLogId)
            : null;

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
                    ...(transfer.paid_at
                        ? { transferredAt: new Date(transfer.paid_at) }
                        : {}),
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
            console.log(
                `[OMISE WEBHOOK] ${evt.key} → ${objectType} (${objectId})`,
            );

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
                    console.log(
                        '[OMISE WEBHOOK] Recipient event received:',
                        evt.data,
                    );
                    break;
            }
        } catch (err) {
            console.error('[OMISE WEBHOOK] Error processing :', err);
            throw new InternalServerErrorException('Webhook processing error');
        }
    }

    async handleGetStreamWebhook(body: any) {
        const eventType: string = body.type;

        if (eventType === 'message.new') {
            infoLog('MESSAGE', 'new message');
            const message: string = body.message.text;
            const senderUserId: User['_id'] = body.user.id;

            const receiver = body.members.find(
                (member) => member.user_id !== senderUserId,
            );

            const receiverUserId: string = receiver.user_id;
            const receiverInfo = await this.userModel.findById(receiverUserId);
            const receiverPhoneNumber: string | undefined = receiverInfo?.phone;
            const receiverPushToken: string | null | undefined =
                receiverInfo?.expoPushToken;

            let hasAlreadyNotified: boolean = false;

            if (receiverPushToken) {
                await this.notificationService.notify({
                    expoPushTokens: receiverPushToken,
                    title: 'มีข้อความใหม่ส่งถึงคุณ',
                    body: message,
                });

                hasAlreadyNotified = true;
            }

            if (receiverPhoneNumber && !hasAlreadyNotified) {
                const formattedMessage: string = `มีนักเรียนส่งข้อความถึงคุณ รายละเอียด ${envConfig.frontEndUrl}/chat`;

                await this.smsService.sendSms(
                    receiverPhoneNumber,
                    formattedMessage,
                );

                hasAlreadyNotified = true;
            }

            this.socketService.emit(SocketEvent.NEW_MESSAGE, {
                receiverUserId,
                senderUserId,
            });

            // if (receiverEmail) {
            //     const sendEmailPayload: SendEmailPayload = {
            //         subject: 'มีนักเรียนส่งข้อความถึงคุณ',
            //         template_uuid: EmailTemplateID.NEW_MESSAGE,
            //         mail_from: {
            //             email: envConfig.thaiBulk.emailSenderName!,
            //         },
            //         mail_to: {
            //             email: receiverEmail,
            //         },
            //         payload: {
            //             MESSAGE: formattedMessage,
            //         },
            //     };

            //     await this.emailService.sendEmail(sendEmailPayload);
            // }
        }

        if (eventType === 'channel.created') {
            const channelId: string = body.channel.id;

            const teacherUserId = channelId.split('teac_').at(1);
            if (!teacherUserId)
                throw new NotFoundException('ไม่พบข้อมูล Id ของคุณครู');

            const teacher = await this.userModel.exists({
                _id: createObjectId(teacherUserId),
            });

            if (!teacher) throw new NotFoundException('ไม่พบข้อมูลคุณครู');

            await this.chatService.sendChatMessage({
                channelId,
                senderUserId: teacherUserId,
                message: `[แจ้งเตือนด้านความปลอดภัย 🔐]
Class Buddy ไม่อนุญาตให้แลกเปลี่ยนข้อมูลส่วนตัว
หรือนัดเจอ/คุยนอกแพลตฟอร์มทุกกรณี
เพื่อปกป้องความปลอดภัยของทั้งครูและนักเรียน ขอบคุณค่ะ/ครับ `,
            });
        }

        if (eventType === 'user.unread_message_reminder') {
            const userWhoDidNotRead = body.user;
            const userId = userWhoDidNotRead.id;
            const receiverInfo = await this.userModel.findById(userId);
            const receiverPhoneNumber: string | undefined = receiverInfo?.phone;

            if (receiverPhoneNumber) {
                const formattedMessage: string = `มีนักเรียนส่งข้อความถึงคุณ รายละเอียด ${envConfig.frontEndUrl}/chat`;

                await this.smsService.sendSms(
                    receiverPhoneNumber,
                    formattedMessage,
                );
            }
        }
    }
}

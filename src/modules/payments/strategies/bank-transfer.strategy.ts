import { InjectQueue } from '@nestjs/bullmq';
import {
    BadRequestException,
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Connection, Model } from 'mongoose';
import { businessConfig } from 'src/configs/business.config';
import { envConfig } from 'src/configs/env.config';
import { EmailService } from 'src/infra/email/email.service';
import { EmailTemplateID } from 'src/infra/email/email.type';
import { Role } from 'src/modules/auth/role/role.enum';
import { Booking } from 'src/modules/booking/schemas/booking.schema';
import { ChatService } from 'src/modules/chat/chat.service';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { Slot } from 'src/modules/slots/schemas/slot.schema';
import { Teacher } from 'src/modules/teachers/schemas/teacher.schema';
import { User } from 'src/modules/users/schemas/user.schema';
import { BullMQJob } from 'src/shared/enums/bull-mq.enum';
import {
    NotificationReceipientType,
    NotificationType,
} from 'src/shared/enums/notification.enum';
import { SlotStatus } from 'src/shared/enums/slot.enum';
import {
    errorLog,
    getErrorMessage,
    infoLog,
} from 'src/shared/utils/shared.util';
import { EasySlipService } from '../easy-slip.service';
import {
    Payment,
    PaymentMethod,
    PaymentStatus,
} from '../schemas/payment.schema';
import { Wallet } from '../schemas/wallet.schema';
import { PaymentStrategy } from './payment-strategy.interface';
import dayjs from 'dayjs';

@Injectable()
export class BankTransferStrategy implements PaymentStrategy {
    method: PaymentMethod = PaymentMethod.BANK_TRANSFER;

    constructor(
        @InjectConnection() private readonly connection: Connection,
        @InjectModel(Booking.name) private bookingModel: Model<Booking>,
        @InjectModel(Wallet.name) private walletModel: Model<Wallet>,
        @InjectModel(Payment.name) private paymentModel: Model<Payment>,
        @InjectModel(Slot.name) private slotModel: Model<Slot>,
        @InjectModel(Teacher.name) private teacherModel: Model<Slot>,
        @InjectModel(User.name) private userModel: Model<User>,
        private readonly notificationService: NotificationsService,
        private readonly chatService: ChatService,
        private readonly emailService: EmailService,
        private readonly easySlipService: EasySlipService,
        @InjectQueue('video') private videoQueue: Queue,
    ) {}

    async pay({
        bookingId,
        currentUserId,
        receiptFile,
    }: {
        bookingId: string;
        currentUserId: string;
        receiptFile: Express.Multer.File;
    }): Promise<void> {
        const session = await this.connection.startSession();

        infoLog('BOOKING', 'กำลังชำระ booking ด้วย BANK_TRANSFER');

        try {
            const booking = await this.bookingModel
                .findById(bookingId)
                .session(session);

            if (!booking) throw new NotFoundException('ไม่พบคลาสดังกล่าว');

            const studentId = booking.studentId.toString();

            const currentUserDidNotBookThisClass = currentUserId !== studentId;

            if (currentUserDidNotBookThisClass)
                throw new UnauthorizedException(
                    'คุณไม่มีสิทธิ์ชำระเงินแทนนักเรียนดังกล่าว',
                );

            await session.withTransaction(async () => {
                // 1 : ตรวจสอบ receipt ของนักเรียน
                const receiptAsBase64 = receiptFile.buffer.toString('base64');

                const {
                    data: receiptInfo,
                    isError: isErrorVerifyingReceipt,
                    message: receiptMessage,
                } = await this.easySlipService.verifyReceipt(
                    receiptAsBase64,
                    booking.price,
                    businessConfig.bankAccountName,
                );

                if (isErrorVerifyingReceipt)
                    throw new BadRequestException(receiptMessage);

                if (!receiptInfo)
                    throw new BadRequestException('ไม่พบข้อมูลของสลิป');

                // 2 : ตรวจสอบว่า สลิปนี้ใช้ไปแล้วหรือยัง
                const existingReceipt = await this.paymentModel
                    .exists({
                        easySlipTransRef: receiptInfo.transRef,
                    })
                    .session(session);

                const alreadyBeenUsed = Boolean(existingReceipt?._id);

                if (alreadyBeenUsed)
                    throw new BadRequestException(
                        'สลิปนี้ถูกใช้งานในการจองครั้งอื่่นแล้ว',
                    );

                // 3 : บันทึก payment ว่าเกิดจากการชำระโดยการโอนเงินผ่านธนาคาร
                this.paymentModel.insertOne(
                    {
                        userId: booking.studentId,
                        teacherId: booking.teacherId,
                        bookingId: booking._id,
                        amount: booking.price,
                        method: PaymentMethod.BANK_TRANSFER,
                        status: PaymentStatus.SUCCESS,
                        easySlipTransRef: receiptInfo.transRef,
                    },
                    { session },
                );

                // 4 : อัปเดตสถานะ Booking เป็น paid
                booking.status = 'paid';
                booking.paidAt = new Date();
                await booking.save({ session });

                // 5 : อัปเดตสถานะ slot เป็น paid
                const slot = await this.slotModel.findOneAndUpdate(
                    { bookingId: booking._id },
                    { status: SlotStatus.PAID, paidAt: new Date() },
                    { session, new: true },
                );

                // 6 : เพิ่มเงินเข้ากระเป๋าตังครู (pendingBalance)
                await this.walletModel.findOneAndUpdate(
                    {
                        userId: booking.teacherId,
                        role: Role.Teacher,
                    },
                    { $inc: { pendingBalance: booking.price } },
                    { upsert: true, session },
                );

                // 7 : สร้างแชทสำหรับครูและนักเรียน
                const teacher = await this.teacherModel
                    .findById(booking.teacherId)
                    .populate('user')
                    .lean<Teacher & { user: User }>();

                if (!teacher)
                    throw new NotFoundException('ไม่พบข้อมูลคุณครูของคลาสนี้');

                const teacherUserId = teacher.userId.toString();

                const channelInfo = await this.chatService.createOrGetChannel(
                    studentId,
                    teacherUserId,
                );

                // 8 : ส่งแจ้งเตือนไปหาคุณครู และ นักเรียน
                await this.notificationService.sendNotification(studentId, {
                    recipientType: NotificationReceipientType.User,
                    message: `ชำระเงินสำเร็จแล้ว 🎉 สามารถตรวจสอบตารางเรียนของคุณได้ที่ตารางของฉัน`,
                    type: NotificationType.BOOKING_PAID,
                });

                await this.notificationService.sendNotification(teacherUserId, {
                    recipientType: NotificationReceipientType.Teacher,
                    message: `มีนักเรียนจองตารางเรียนกับคุณแล้ว ✨ ตรวจสอบรายละเอียดการสอน`,
                    type: NotificationType.BOOKING_PAID,
                });

                // 9 : ส่งแจ้งเตือน ไปหาครูและนักเรียน
                const teacherEmail = teacher.user.email;
                const teacherPushToken = teacher.user.expoPushToken;

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

                if (teacherPushToken) {
                    await this.notificationService.notify({
                        expoPushTokens: teacherPushToken,
                        title: 'มีนักเรียนชำระเงิน',
                        body: 'ยินดีด้วย คุณมีนักเรียนชำระเงินให้คุณแล้ว ตรวจสอบตารางเรียนของคุณได้ที่ตารางของฉัน',
                    });
                }

                // 10 : ส่งข้อความไปในแชทรวม
                const channelId = channelInfo.id;
                const student = await this.userModel.findById(studentId).lean();

                if (!channelId)
                    throw new NotFoundException('ไม่พบข้อมูลแชทรวม');
                if (!student)
                    throw new NotFoundException('ไม่พบข้อมูลนักเรียน');
                if (!slot) throw new NotFoundException('ไม่พบข้อมูลตารางเรียน');

                const startLocal = dayjs.utc(slot.startTime).tz('Asia/Bangkok');
                const endLocal = dayjs.utc(slot.endTime).tz('Asia/Bangkok');

                await this.chatService.sendChatMessage({
                    channelId,
                    message: `[ชำระเงินสำเร็จ 💰]
นักเรียน ${student.name} ${student.lastName} ได้ชำระเงินสำเร็จแล้ว ✨ 
เวลาเรียน : ${startLocal.locale('th').format('DD/MM/YYYY HH:mm')} - ${endLocal.locale('th').format('DD/MM/YYYY HH:mm')}
รายละเอียดตารางสอน : ${envConfig.frontEndUrl}/my-teacher-profile
รายละเอียดตารางเรียน : ${envConfig.frontEndUrl}/profile
`,
                    senderUserId: studentId,
                });

                infoLog('BOOKING', 'ชำระตลาสเรียนด้วย BANK_TRANSFER สำเร็จ!');
            });

            // 11 : ส่ง Queue สร้างห้องสำหรับ class เรียนเนื่องจากค่อนข้างใช้เวลา
            await this.videoQueue.add(BullMQJob.CREATE_CALLROOM, {
                bookingId: booking._id,
            });
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);

            errorLog(
                'BOOKING',
                `ล้มเหลวระหว่างสร้าง Booking โดยใช้ BANK_TRANSFER -> ${errorMessage}`,
            );

            throw error;
        } finally {
            session.endSession();
        }
    }
}

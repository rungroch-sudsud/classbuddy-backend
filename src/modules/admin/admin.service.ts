import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Teacher } from '../teachers/schemas/teacher.schema';
import { Connection, isValidObjectId, Model } from 'mongoose';
import { Notification } from '../notifications/schema/notification';
import { Booking } from '../booking/schemas/booking.schema';
import { SmsService } from 'src/infra/sms/sms.service';
import { User } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatService } from '../chat/chat.service';
import { Role } from '../auth/role/role.enum';
import { businessConfig } from 'src/configs/business.config';
import { NotFound } from '@aws-sdk/client-s3';
import { SmsMessageBuilder } from 'src/infra/sms/builders/sms-builder.builder';

const Omise = require('omise');

@Injectable()
export class AdminService {
    private omise: any;

    constructor(
        @InjectConnection() private readonly connection: Connection,
        @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
        @InjectModel(User.name) private userModel: Model<User>,
        @InjectModel(Booking.name)
        private bookingModel: Model<Booking>,
        @InjectModel(Notification.name)
        private notificationModel: Model<Notification>,
        private smsService: SmsService,
        private notificationService: NotificationsService,
        private chatService: ChatService,
    ) {
        const secretKey = process.env.OMISE_SECRET_KEY;
        const publicKey = process.env.OMISE_PUBLIC_KEY;
        this.omise = Omise({ secretKey, publicKey });
    }

    async getPendingTeachers(): Promise<Teacher[]> {
        return this.teacherModel
            .find({ verifyStatus: 'pending' })
            .select(
                'name lastName idCard idCardWithPerson certificate verifyStatus',
            )
            .lean();
    }

    async verifyTeacher(teacherId: string) {
        const session = await this.connection.startSession();

        if (!isValidObjectId(teacherId)) {
            throw new BadRequestException('ไอดีของครูไม่ถูกต้อง');
        }

        const teacher = await this.teacherModel
            .findById(teacherId)
            .session(session);
        if (!teacher) throw new NotFoundException('ไม่พบครูในระบบ');

        const teacherUser = await this.userModel
            .findById(teacher.userId)
            .session(session);
        if (!teacherUser) throw new NotFoundException('ไม่พบผู้ใช้งานครู');

        if (teacher.verifyStatus === 'verified') {
            throw new BadRequestException('บัญชีนี้ยืนยันตัวตนเรียบร้อยแล้ว');
        }

        if (
            !teacher.bankName ||
            !teacher.bankAccountName ||
            !teacher.bankAccountNumber
        ) {
            throw new BadRequestException('ข้อมูลบัญชีธนาคารไม่ครบถ้วน');
        }

        try {
            // 1. สร้างบัญชีธนาคารใหม่สำหรับ Omise ของคุณครู
            const recipient = await this.omise.recipients.create({
                name: teacher.bankAccountName,
                type: 'individual',
                bank_account: {
                    brand: teacher.bankName,
                    number: teacher.bankAccountNumber,
                    name: teacher.bankAccountName,
                },
            });

            await session.withTransaction(async () => {
                // 2. ปรับสถานะ account ของคุณครู
                teacher.recipientId = recipient.id;
                teacher.verifyStatus = 'verified';
                await teacher.save({ session });

                // 3. แจ้งเตือนคุณครูว่าได้รับการอนุมัติแล้ว
                let hasNotifiedTeacher: boolean = false;
                const teacherPushTokens = teacherUser.expoPushToken;

                if (teacherPushTokens.length > 0) {
                    await this.notificationService.notify({
                        expoPushTokens: teacherPushTokens,
                        title: 'อนุมัติบัญชี',
                        body: 'ทางแอดมินได้อนุมัติบัญชีเรียบร้อยครับ 🎉🎉',
                    });

                    hasNotifiedTeacher = true;
                }

                if (!hasNotifiedTeacher) {
                    await this.smsService.sendSms(
                        teacherUser.phone,
                        'ทางแอดมินได้อนุมัติบัญชีเรียบร้อยครับ 🎉🎉',
                    );

                    hasNotifiedTeacher = true;
                }

                // 4. ส่งข้อความไปในแชทของคุณครู (โดยใช้ account admin ส่งไป)
                const adminPhoneNumber: string | undefined =
                    businessConfig.coFounderPhones.at(0);

                if (!adminPhoneNumber)
                    throw new NotFoundException('ไม่พบเบอร์แอดมินในระบบ');

                const adminUser = await this.userModel
                    .findOne({
                        role: Role.Admin,
                        phone: adminPhoneNumber,
                    })
                    .lean()
                    .session(session);

                if (!adminUser)
                    throw new NotFoundException('ไม่พบบัญชีผู้ใช้ของแอดมิน');

                const channel = await this.chatService.createOrGetChannel(
                    adminUser._id.toString(),
                    teacher.userId.toString(),
                );

                if (!channel || !channel.id)
                    throw new InternalServerErrorException(
                        'ล้มเหลวระหว่างสร้าง หรือ ดึงข้อมูลห้องบทสนทนา',
                    );

                const messageBuilder = new SmsMessageBuilder();

                messageBuilder
                    .addText('สวัสดีครับ ผมแอดมินของ Class Buddy นะครับ')
                    .newLine()
                    .addText(
                        'ทางแอดมินได้ทำการอนุมัติบัญชีเรียบร้อยนะคร้าบบบ ขอบคุณที่สมัครเข้ามาครับ',
                    )
                    .newLine()
                    .addText(
                        'ทางแพลตฟอร์มปล่อยให้ใช้งานฟรี ไม่มีค่าใช้จ่าย จนถึงปลายเดือนมกราคมนี้นะครับผม',
                    )
                    .newLine()
                    .addText(
                        'มีปัญหาแจ้งมาได้ตลอดนะครับ พร้อมผลักดันการศึกษาไทยให้ไปไกลกว่าเดิมครับ',
                    );

                await this.chatService.sendChatMessage({
                    channelId: channel.id,
                    message: messageBuilder.getMessage(),
                    senderUserId: adminUser._id.toString(),
                });
            });

            return teacher;
        } catch (error) {
            if (error?.code === 'invalid_bank_account') {
                throw new BadRequestException(
                    `ข้อมูลบัญชีธนาคารไม่ถูกต้อง กรุณาตรวจสอบเลขบัญชีอีกครั้ง'}`,
                );
            }

            if (error?.object === 'error' && error?.message) {
                throw new BadRequestException(
                    `เกิดข้อผิดพลาดจาก Omise: ${error.message}`,
                );
            }

            console.error('Omise unexpected error:', error);
            throw error;
        }
    }

    async rejectTeacher(teacherId: string) {
        if (!isValidObjectId(teacherId)) {
            throw new BadRequestException('ไอดีของครูไม่ถูกต้อง');
        }

        const teacher = await this.teacherModel.findById(teacherId);
        if (!teacher) throw new NotFoundException('ไม่พบครูในระบบ');

        // if (teacher.verifyStatus === 'verified') {
        //     throw new BadRequestException(
        //         'ครูคนนี้ได้รับการยืนยันแล้ว ไม่สามารถปฏิเสธได้',
        //     );
        // }

        // teacher.idCardWithPerson = null;
        // teacher.certificate = [];
        teacher.verifyStatus = 'draft';

        await teacher.save();

        await this.notificationModel.create({
            recipientId: teacher._id,
            recipientType: 'Teacher',
            message:
                'การยืนยันตัวตนของคุณไม่ผ่าน โปรดตรวจสอบและอัปโหลดเอกสารใหม่อีกครั้ง',
            type: 'system',
            senderType: 'System',
            isRead: false,
        });

        return teacher;
    }

    async getIncomingClasses(): Promise<Booking[]> {
        const now = new Date();

        const incomingClasses = await this.bookingModel
            .find({
                startTime: { $gte: now },
                status: { $in: ['pending', 'paid'] },
            })
            .populate('studentId', 'name lastName profileImage')
            .populate({
                path: 'teacherId',
                select: 'name lastName verifyStatus userId',
                populate: {
                    path: 'userId',
                    select: 'profileImage',
                },
            })
            .populate('subject', '_id name')
            .sort({ startTime: 1 })
            .lean();

        return incomingClasses;
    }
}

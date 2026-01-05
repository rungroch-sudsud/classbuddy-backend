import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Teacher } from '../teachers/schemas/teacher.schema';
import { isValidObjectId, Model } from 'mongoose';
import { Notification } from '../notifications/schema/notification';
import { Booking } from '../booking/schemas/booking.schema';

const Omise = require('omise');

@Injectable()
export class AdminService {
    private omise: any;

    constructor(
        @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
        @InjectModel(Notification.name)
        private notificationModel: Model<Notification>,
        @InjectModel(Booking.name) private bookingModel: Model<Booking>,
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
        if (!isValidObjectId(teacherId)) {
            throw new BadRequestException('ไอดีของครูไม่ถูกต้อง');
        }

        const teacher = await this.teacherModel.findById(teacherId);
        if (!teacher) throw new NotFoundException('ไม่พบครูในระบบ');

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
            const recipient = await this.omise.recipients.create({
                name: teacher.bankAccountName,
                type: 'individual',
                bank_account: {
                    brand: teacher.bankName,
                    number: teacher.bankAccountNumber,
                    name: teacher.bankAccountName,
                },
            });

            teacher.recipientId = recipient.id;
            teacher.verifyStatus = 'verified';
            await teacher.save();

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
            throw new InternalServerErrorException(
                'ไม่สามารถเชื่อมต่อกับ Omise ได้ในขณะนี้',
            );
        }
    }

    async rejectTeacher(teacherId: string) {
        if (!isValidObjectId(teacherId)) {
            throw new BadRequestException('ไอดีของครูไม่ถูกต้อง');
        }

        const teacher = await this.teacherModel.findById(teacherId);
        if (!teacher) throw new NotFoundException('ไม่พบครูในระบบ');

        if (teacher.verifyStatus === 'verified') {
            throw new BadRequestException(
                'ครูคนนี้ได้รับการยืนยันแล้ว ไม่สามารถปฏิเสธได้',
            );
        }

        teacher.idCardWithPerson = null;
        teacher.certificate = [];
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

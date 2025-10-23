import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Teacher } from '../teachers/schemas/teacher.schema';
import { isValidObjectId, Model } from 'mongoose';
import { Notification } from '../notifications/schema/notification';

const Omise = require('omise');

@Injectable()
export class AdminService {
    private omise: any;

    constructor(
        @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
        @InjectModel(Notification.name) private notificationModel: Model<Notification>,
    ) {
        const secretKey = process.env.OMISE_SECRET_KEY;
        const publicKey = process.env.OMISE_PUBLIC_KEY;
        this.omise = Omise({ secretKey, publicKey });
    }


    async getPendingTeachers(): Promise<Teacher[]> {
        return this.teacherModel
            .find({ verifyStatus: 'pending' })
            .select('name lastName idCard idCardWithPerson certificate verifyStatus')
            .lean();
    }


    async verifyTeacher(teacherId: string) {
        if (!isValidObjectId(teacherId)) {
            throw new BadRequestException('ไอดีของครูไม่ถูกต้อง')
        }

        const teacher = await this.teacherModel.findById(teacherId);
        if (!teacher) throw new NotFoundException('ไม่พบครูในระบบ');

        if (teacher.verifyStatus === 'verified') {
            throw new BadRequestException('บัญชีนี้ยืนยันตัวตนเรียบร้อยแล้ว');
        }

        if (teacher.verifyStatus !== 'pending') {
            throw new BadRequestException('ครูคนนี้ยังไม่พร้อมสำหรับการยืนยัน');
        }

        if (!teacher.bankName || !teacher.bankAccountName || !teacher.bankAccountNumber) {
            throw new BadRequestException('ข้อมูลบัญชีธนาคารไม่ครบถ้วน');
        }

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
        teacher.verifyStatus = 'process';

        await teacher.save();

        return teacher
    }


    async rejectTeacher(teacherId: string) {
        if (!isValidObjectId(teacherId)) {
            throw new BadRequestException('ไอดีของครูไม่ถูกต้อง');
        }

        const teacher = await this.teacherModel.findById(teacherId);
        if (!teacher) throw new NotFoundException('ไม่พบครูในระบบ');

        if (teacher.verifyStatus === 'verified') {
            throw new BadRequestException('ครูคนนี้ได้รับการยืนยันแล้ว ไม่สามารถปฏิเสธได้');
        }

        teacher.idCardWithPerson = null;
        teacher.certificate = [];
        teacher.verifyStatus = 'draft';

        await teacher.save();

        await this.notificationModel.create({
            recipientId: teacher._id,
            recipientType: 'Teacher',
            message: 'การยืนยันตัวตนของคุณไม่ผ่าน โปรดตรวจสอบและอัปโหลดเอกสารใหม่อีกครั้ง',
            type: 'system',
            senderType: 'System',
            isRead: false,
        });

        return teacher;
    }

}

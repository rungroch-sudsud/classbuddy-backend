import {
    BadRequestException,
    ConflictException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { S3Service } from 'src/infra/s3/s3.service';
import { Teacher, TeacherDocument } from './schemas/teacher.schema';
// import { , reviewTeacherDto, UpdateTeacherDto } from './schemas/teacher.zod.schema';
import {
    createObjectId,
    errorLog,
    getErrorMessage,
    infoLog,
} from 'src/shared/utils/shared.util';
import { StreamChatService } from '../chat/stream-chat.service';
import { PaymentDocument } from '../payments/schemas/payment.schema';
import { PayoutLog } from '../payments/schemas/payout.schema';
import { Wallet } from '../payments/schemas/wallet.schema';
import { Slot } from '../slots/schemas/slot.schema';
import { SocketService } from '../socket/socket.service';
import { SubjectList } from '../subjects/schemas/subject.schema';
import { User } from '../users/schemas/user.schema';
import {
    CreateTeacherProfileDto,
    UpdateTeacherDto,
} from './dto/teacher.dto.zod';
import {
    PaymentHistoryResponseDto,
    ReviewResponseDto,
} from './dto/teacher.response.zod';
import { SmsService } from 'src/infra/sms/sms.service';
import { SmsMessageBuilder } from 'src/infra/sms/builders/sms-builder.builder';
import { envConfig } from 'src/configs/env.config';
import { VideoService } from '../chat/video.service';

@Injectable()
export class TeachersService {
    constructor(
        private readonly s3Service: S3Service,
        private readonly socketService: SocketService,
        private readonly streamChatService: StreamChatService,
        private readonly smsService: SmsService,
        private readonly videoService: VideoService,
        @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
        @InjectModel(User.name) private userModel: Model<User>,
        @InjectModel(Slot.name) private slotModel: Model<Slot>,
        @InjectModel(SubjectList.name) private subjectModel: Model<SubjectList>,
        @InjectModel(Wallet.name) private walletModel: Model<Wallet>,
        @InjectModel(PayoutLog.name) private payoutLogModel: Model<PayoutLog>,
    ) {}

    private async findTeacher(userId: string): Promise<TeacherDocument | null> {
        return this.teacherModel.findOne({
            userId: new Types.ObjectId(userId),
        });
    }

    private checkIfVerificationComplete(teacher: Teacher): boolean {
        return (
            !!teacher.idCardWithPerson &&
            !!teacher.certificate &&
            teacher.certificate.length > 0
        );
    }

    async createTeacherProfile(
        userId: string,
        body: CreateTeacherProfileDto,
    ): Promise<any> {
        const exist = await this.findTeacher(userId);
        if (exist) throw new ConflictException('มีครูคนนี้อยู่ในระบบอยู่แล้ว');

        const user = await this.userModel.findById(userId);
        if (!user) throw new NotFoundException('ไม่พบผู้ใช้งาน');

        user.name = body.name;
        user.lastName = body.lastName;
        user.email = body.email;
        user.age = body.age;
        user.nickName = body.nickName;
        user.subjects = body.subjects.map((subjectId) =>
            createObjectId(subjectId),
        );

        await user.save();

        const userObjId = new Types.ObjectId(userId);

        const teacher = new this.teacherModel({
            ...body,
            userId: userObjId,
            name: user.name,
            lastName: user.lastName,
        });

        await teacher.save();

        const wallet = await new this.walletModel({
            userId: teacher._id,
            role: 'teacher',
        }).save();

        await this.smsService.sendSms(
            ['0611752168', '0853009999'],
            'มีคุณครูสมัครมา 1 อัตรา',
        );

        return { teacher, wallet };
    }

    // async updatePayments(
    //     userId: string,
    //     body: UpdateTeacherDto
    // ): Promise<Teacher> {
    //     const exist = await this.findTeacher(userId);
    //     if (exist) throw new ConflictException('มีครูคนนี้อยู่ในระบบอยู่แล้ว');

    //     const createTeacher = new this.teacherModel({
    //         ...body,
    //         userId: new Types.ObjectId(userId)
    //     });

    //     return createTeacher.save();
    // }

    async updateIdCardWithPerson(
        userId: string,
        file: Express.Multer.File,
    ): Promise<string> {
        const teacher = await this.findTeacher(userId);
        if (!teacher) throw new NotFoundException('ไม่พบครูในระบบ');

        // if (teacher.verifyStatus === 'verified') {
        //     throw new BadRequestException('บัญชีได้รับการยืนยันแล้ว ไม่สามารถอัปโหลดบัตรประชาชนได้');
        // }

        const filePath = `teacher/${userId}/id-card-with-person`;
        const publicFileUrl = await this.s3Service.uploadPublicReadFile(
            file,
            filePath,
        );

        teacher.idCardWithPerson = publicFileUrl;

        if (this.checkIfVerificationComplete(teacher)) {
            teacher.verifyStatus = 'pending';
        }

        await teacher.save();

        return publicFileUrl;
    }

    async updateCertificate(
        userId: string,
        files: Express.Multer.File[],
    ): Promise<string[]> {
        const teacher = await this.findTeacher(userId);
        if (!teacher) throw new NotFoundException('ไม่พบครูในระบบ');

        // if (teacher.verifyStatus === 'verified') {
        //     throw new BadRequestException('บัญชีได้รับการยืนยันแล้ว ไม่สามารถอัปโหลดบัตรประชาชนได้');
        // }

        const filePath = `teacher/${userId}/certificate`;

        const publicFileUrls = await Promise.all(
            files.map((file) =>
                this.s3Service.uploadPublicReadFile(file, filePath),
            ),
        );

        teacher.certificate = publicFileUrls;

        if (this.checkIfVerificationComplete(teacher)) {
            teacher.verifyStatus = 'pending';
        }

        await teacher.save();

        return publicFileUrls;
    }

    async getAllTeacher(): Promise<Teacher[]> {
        const teachers = await this.teacherModel
            .find()
            .populate('userId', '_id profileImage')
            .populate('subjects')
            .lean();

        return teachers.map((teacher: any) => {
            const user =
                typeof teacher.userId === 'object'
                    ? teacher.userId
                    : { _id: teacher.userId, profileImage: null };

            const isOnline = this.socketService.isOnline(user._id?.toString());

            return {
                ...teacher,
                userId: user._id ?? null,
                profileImage: user.profileImage ?? null,
                subjects: teacher.subjects ?? [],
                isOnline,
            };
        });
    }

    async getTeachers(
        search?: string,
        sort?: 'rating' | 'priceAsc' | 'priceDesc',
        page = 1,
        limit = 10,
    ): Promise<any> {
        const query: any = { verifyStatus: 'verified' };
        let subjectIds: Types.ObjectId[] = [];

        if (search && search.trim() !== '') {
            const subjectMatches = await this.subjectModel
                .find({ name: { $regex: search, $options: 'i' } })
                .select('_id');
            subjectIds = subjectMatches.map((s) => s._id);

            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { bio: { $regex: search, $options: 'i' } },
                { subjects: { $in: subjectIds } },
            ];
        }

        let sortOption = {};
        switch (sort) {
            case 'rating':
                sortOption = { averageRating: -1 };
                break;
            case 'priceAsc':
                sortOption = { hourlyRate: 1 };
                break;
            case 'priceDesc':
                sortOption = { hourlyRate: -1 };
                break;
            default:
                sortOption = { averageRating: -1 };
        }

        const skip = (page - 1) * limit;

        const [teachers, total] = await Promise.all([
            this.teacherModel
                .find(query)
                .populate('userId', '_id profileImage')
                .populate('subjects', 'name')
                .select(
                    `
                        -idCardWithPerson -bankName -certificate
                     -bankAccountName -bankAccountNumber -recipientId
                     -reviews 
                     `,
                )
                .sort(sortOption)
                .skip(skip)
                .limit(limit)
                .lean(),
            this.teacherModel.countDocuments(query),
        ]);

        const teachersWithStats = await Promise.all(
            teachers.map(async (teacher: any) => {
                const userId = teacher.userId?._id ?? null;
                const profileImage = teacher.userId?.profileImage ?? null;
                const isVerified = teacher.verifyStatus === 'verified';
                const isOnline = userId
                    ? this.socketService.isOnline(userId.toString())
                    : false;

                return {
                    ...teacher,
                    userId,
                    profileImage,
                    isVerified,
                    isOnline,
                };
            }),
        );

        return {
            data: teachersWithStats,
            total,
            page,
            limit,
        };
    }

    async getTeacherProfileMine(
        teacherId: string,
    ): Promise<Record<string, any>> {
        const teacher = await this.findTeacher(teacherId);
        if (!teacher) throw new NotFoundException('ไม่พบข้อมูลผู้ใช้');

        await teacher.populate([
            { path: 'subjects' },
            { path: 'userId', select: '_id profileImage' },
        ]);

        const wallet = await this.walletModel
            .findOne({
                userId: teacher._id,
            })
            .select('-role');

        const teacherObj = teacher.toObject();
        const userId = teacher.userId?._id ?? null;
        const profileImage = (teacherObj.userId as any)?.profileImage ?? null;

        const isOnline = userId
            ? this.socketService.isOnline(userId.toString())
            : false;

        return {
            ...teacherObj,
            userId,
            profileImage,
            wallet,
            isOnline,
        };
    }

    async getTeacherProfileByUserId(
        teacherUserId: string,
    ): Promise<Record<string, any>> {
        if (!Types.ObjectId.isValid(teacherUserId)) {
            throw new BadRequestException('รหัสของครูไม่ถูกต้อง');
        }

        let teacher = await this.teacherModel
            .findOne({ userId: new Types.ObjectId(teacherUserId) })
            .select(
                `
                     -idCardWithPerson -bankName
                     -bankAccountName -bankAccountNumber -recipientId
                     -certificate
                     `,
            )
            .populate([
                { path: 'subjects' },
                { path: 'userId', select: '_id profileImage' },
                {
                    path: 'reviews',
                    populate: {
                        path: 'reviewerId',
                        select: 'name lastName profileImage',
                    },
                },
            ])
            .lean<Omit<Teacher, 'reviews'> & { reviews: any }>();

        if (!teacher) throw new NotFoundException('ไม่พบข้อมูลผู้ใช้');

        teacher.reviews = teacher.reviews.map((review) => {
            const { reviewerId, ...rest } = review;

            return { reviewer: reviewerId, ...rest };
        });

        const profileImage = (teacher.userId as any)?.profileImage ?? null;

        const isOnline = teacherUserId
            ? this.socketService.isOnline(teacherUserId.toString())
            : false;

        return {
            ...teacher,
            userId: teacherUserId,
            profileImage,
            isOnline,
        };
    }

    async getTeacherProfileById(
        teacherId: string,
    ): Promise<Record<string, any>> {
        if (!Types.ObjectId.isValid(teacherId)) {
            throw new BadRequestException('รหัสของครูไม่ถูกต้อง');
        }

        let teacher = await this.teacherModel
            .findById(new Types.ObjectId(teacherId))
            .select(
                `
                     -idCardWithPerson -bankName
                     -bankAccountName -bankAccountNumber -recipientId
                     -certificate
                     `,
            )
            .populate([
                { path: 'subjects' },
                { path: 'userId', select: '_id profileImage' },
                {
                    path: 'reviews',
                    populate: {
                        path: 'reviewerId',
                        select: 'name lastName profileImage',
                    },
                },
            ])
            .lean<Omit<Teacher, 'reviews'> & { reviews: any }>();

        if (!teacher) throw new NotFoundException('ไม่พบข้อมูลผู้ใช้');

        teacher.reviews = teacher.reviews.map((review) => {
            const { reviewerId, ...rest } = review;

            return { reviewer: reviewerId, ...rest };
        });
        const userId = teacher.userId?._id ?? null;
        const profileImage = (teacher.userId as any)?.profileImage ?? null;

        const isOnline = userId
            ? this.socketService.isOnline(userId.toString())
            : false;

        return {
            ...teacher,
            userId,
            profileImage,
            isOnline,
        };
    }

    async updateTeacherProfile(
        userId: string,
        body: UpdateTeacherDto,
    ): Promise<Teacher> {
        const { customSubjects, ...updateData } = body;

        if (customSubjects && customSubjects.trim() !== '') {
            updateData['customSubjects'] = customSubjects.trim();
        }

        const updated = await this.teacherModel.findOneAndUpdate(
            { userId: new Types.ObjectId(userId) },
            { $set: updateData },
            { new: true },
        );

        if (!updated) throw new NotFoundException('ไม่พบข้อมูลครู');

        if (updated.verifyStatus === 'verified') {
            try {
                const user = await this.userModel.findById(userId).lean();
                const image = user?.profileImage ?? undefined;

                await this.streamChatService.upsertUser({
                    id: `teacher_${userId}`,
                    name: `${updated.name ?? ''} ${updated.lastName ?? ''}`.trim(),
                    image,
                });

                console.log(
                    `[getStream] upsert verified teacher_${userId} successful`,
                );

                this.smsService.sendSms(
                    ['0611752168', '0853009999'],
                    'มีคุณครู update profile 1 ท่าน',
                );
            } catch (err) {
                console.warn(
                    '[getStream] Failed to upsert teacher:',
                    err.message,
                );
            }
        }

        return updated;
    }

    //Revice Section
    async addReview(
        teacherId: string,
        reviewerId: string,
        body: any,
    ): Promise<ReviewResponseDto> {
        const teacher = await this.teacherModel.findById(teacherId);
        if (!teacher) throw new NotFoundException('ไม่พบครู');

        const alreadyReviewed = teacher.reviews.find(
            (r) => r.reviewerId.toString() === reviewerId,
        );
        if (alreadyReviewed)
            throw new BadRequestException('คุณได้รีวิวครูคนนี้ไปแล้ว');

        const reviewrObjId = new Types.ObjectId(reviewerId);

        const hasStudy = await this.slotModel.findOne({
            teacherId: teacher._id,
            bookedBy: reviewrObjId,
            status: 'studied',
        });

        if (!hasStudy)
            throw new BadRequestException('คุณยังไม่เคยเรียนกับครูคนนี้');

        teacher.reviews.push({
            reviewerId: reviewrObjId,
            rating: body.rating,
            comment: body.comment,
            createdAt: new Date(),
        });

        const total = teacher.reviews.reduce((sum, r) => sum + r.rating, 0);
        const count = teacher.reviews.length;
        const avg = total / count;

        teacher.averageRating = Number(avg.toFixed(1));
        teacher.reviewCount = count;
        teacher.satisfactionRate = Math.round((avg / 5) * 100);

        await teacher.save();

        // ส่ง SMS แจ้งคุณครูว่ามีนักเรียนรีวิวแล้ว
        const teacherUserInfo = await this.userModel
            .findById(teacher.userId)
            .lean();
        const teacherPhone = teacherUserInfo?.phone;

        if (teacherPhone) {
            const smsBuilder = new SmsMessageBuilder();

            smsBuilder
                .addText('มีนักเรียนรีวิวการสอนของท่าน 1 อัตรา')
                .newLine()
                .addText(
                    `รายละเอียด : ${envConfig.frontEndUrl}/teacher-profile/${teacherId}`,
                );

            const smsMessage = smsBuilder.getMessage();

            await this.smsService.sendSms(teacherPhone, smsMessage);
        }

        return {
            averageRating: teacher.averageRating,
            reviewCount: teacher.reviewCount,
            satisfactionRate: teacher.satisfactionRate,
        };
    }

    async deleteReview(teacherId: string, reviewerId: string): Promise<void> {
        const teacher = await this.teacherModel.findById(teacherId);
        if (!teacher) throw new NotFoundException('ไม่พบครู');

        const reviewIndex = teacher.reviews.findIndex(
            (r) => r.reviewerId.toString() === reviewerId,
        );
        if (reviewIndex === -1) {
            throw new NotFoundException('ไม่พบรีวิวของคุณในครูคนนี้');
        }

        teacher.reviews.splice(reviewIndex, 1);

        if (teacher.reviews.length > 0) {
            const total = teacher.reviews.reduce((sum, r) => sum + r.rating, 0);
            teacher.reviewCount = teacher.reviews.length;
            teacher.averageRating = total / teacher.reviewCount;
            teacher.satisfactionRate = Math.round(
                (teacher.averageRating / 5) * 100,
            );
        } else {
            teacher.reviewCount = 0;
            teacher.averageRating = 0;
            teacher.satisfactionRate = 0;
        }

        await teacher.save();
    }

    async getTeacherWallet(teacherId: string): Promise<Wallet> {
        const teacher = await this.findTeacher(teacherId);
        if (!teacher) throw new NotFoundException('ไม่พบครู');

        const wallet = await this.walletModel.findOne({
            userId: teacher._id,
        });

        if (!wallet) throw new NotFoundException('ไม่พบ wallet');

        if (wallet.userId.toString() !== teacher._id.toString()) {
            throw new ConflictException('คุณไม่มีสิทธิ์เข้าถึง');
        }

        return wallet;
    }

    async getPaymentHistory(
        teacherId: string,
        startDate?: string,
        endDate?: string,
    ): Promise<PaymentHistoryResponseDto> {
        const teacher = await this.findTeacher(teacherId);
        if (!teacher) throw new NotFoundException('ไม่พบครู');

        const teacherObjId = new Types.ObjectId(teacher._id);

        const filter: FilterQuery<PaymentDocument> = {
            teacherId: teacherObjId,
            status: 'paid',
        };

        if (startDate || endDate) {
            filter.transferredAt = {};

            if (startDate)
                filter.transferredAt.$gte = new Date(
                    `${startDate}T00:00:00.000Z`,
                );

            if (endDate)
                filter.transferredAt.$lte = new Date(
                    `${endDate}T23:59:59.999Z`,
                );
        }

        const wallet = await this.walletModel.findOne({
            userId: teacherObjId,
        });
        if (!wallet) throw new BadRequestException('ไม่พบ wallet');

        const payoutLogs = await this.payoutLogModel.find(filter).lean();

        let totalPayoutAmount = 0;
        let totalTeacherNet = 0;
        let totalCommission = 0;

        for (const log of payoutLogs) {
            totalPayoutAmount += log.amount ?? 0;
            totalTeacherNet += log.teacherNet ?? 0;
            totalCommission += (log.systemFee ?? 0) + (log.gatewayFee ?? 0);
        }

        return {
            startDate: startDate || null,
            endDate: endDate || null,
            totalPayoutAmount,
            totalTeacherNet,
            totalCommission,
            availableBalance: wallet.availableBalance,
            processingBalance: wallet.lockedBalance,
        };
    }

    async getOrCreatePracticeClassroom(teacherUserId: string): Promise<string> {
        try {
            const { success, callRoomId } =
                await this.videoService.getOrCreatePracticeCallRoom(
                    teacherUserId,
                );

            if (!success || !callRoomId)
                throw new Error(
                    'ล้มเหลวระหว่าง สร้าง หรือ ดึงข้อมูลห้องสำหรับซ้อมสอน',
                );

            return callRoomId;
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);

            errorLog(
                'TEACHER',
                `[TEACHER SERVICE] [CREATE_PRACTICE_CLASSROOM]-> ${errorMessage}`,
            );
            throw new InternalServerErrorException(
                'ล้มเหละวระหว่าง ดึงข้อมูล ห้องสำหรับซ้อนสอน',
            );
        }
    }
}

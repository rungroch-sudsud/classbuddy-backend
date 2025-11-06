import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Teacher, TeacherDocument } from './schemas/teacher.schema';
import { S3Service } from 'src/infra/s3/s3.service';
import { CreateTeacherProfileDto, reviewTeacherDto, UpdateTeacherDto } from './schemas/teacher.zod.schema';
import { Slot } from '../slots/schemas/slot.schema';
import { StreamChatService } from '../chat/stream-chat.service';
import { User } from '../users/schemas/user.schema';
import { SocketService } from '../socket/socket.service';


@Injectable()
export class TeachersService {
    constructor(
        @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
        @InjectModel(User.name) private userModel: Model<User>,
        @InjectModel(Slot.name) private slotModel: Model<Slot>,
        private readonly s3Service: S3Service,
        private readonly socketService: SocketService,
        private readonly streamChatService: StreamChatService
    ) { }

    private async findTeacher(userId: string): Promise<TeacherDocument | null> {
        return this.teacherModel.findOne({ userId: new Types.ObjectId(userId) });
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
        body: CreateTeacherProfileDto
    ): Promise<TeacherDocument> {
        const exist = await this.findTeacher(userId);
        if (exist) throw new ConflictException('มีครูคนนี้อยู่ในระบบอยู่แล้ว');

        const user = await this.userModel.findById(userId);
        if (!user) throw new NotFoundException('ไม่พบผู้ใช้งาน');

        const createTeacher = new this.teacherModel({
            ...body,
            userId: new Types.ObjectId(userId),
            name: user.name,
            lastName: user.lastName,
        });

        return createTeacher.save();
    }


    async updatePayments(
        userId: string,
        body: any
    ): Promise<TeacherDocument> {
        const exist = await this.findTeacher(userId);
        if (exist) throw new ConflictException('มีครูคนนี้อยู่ในระบบอยู่แล้ว');

        const createTeacher = new this.teacherModel({
            ...body,
            userId: new Types.ObjectId(userId)
        });

        return createTeacher.save();
    }

    async updateIdCardWithPerson(
        userId: string,
        file: Express.Multer.File,
    ): Promise<string> {
        const teacher = await this.findTeacher(userId)
        if (!teacher) throw new NotFoundException('ไม่พบครูในระบบ');

        if (teacher.verifyStatus === 'verified') {
            throw new BadRequestException('บัญชีได้รับการยืนยันแล้ว ไม่สามารถอัปโหลดบัตรประชาชนได้');
        }

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
        const teacher = await this.findTeacher(userId)
        if (!teacher) throw new NotFoundException('ไม่พบครูในระบบ');

        if (teacher.verifyStatus === 'verified') {
            throw new BadRequestException('บัญชีได้รับการยืนยันแล้ว ไม่สามารถอัปโหลดบัตรประชาชนได้');
        }

        const filePath = `teacher/${userId}/certificate`;

        const publicFileUrls = await Promise.all(
            files.map(file => this.s3Service.uploadPublicReadFile(file, filePath)),
        );

        teacher.certificate = publicFileUrls;

        if (this.checkIfVerificationComplete(teacher)) {
            teacher.verifyStatus = 'pending';
        }

        await teacher.save();

        return publicFileUrls;
    }


    async getAllTeacher(): Promise<any[]> {
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

        if (search && search.trim() !== '') {
            query.$or = [
                { 'userId.name': { $regex: search, $options: 'i' } },
                { 'userId.lastName': { $regex: search, $options: 'i' } },
                { bio: { $regex: search, $options: 'i' } },
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
                .populate('subjects')
                .select(`
                        -idCardWithPerson -bankName -certificate
                     -bankAccountName -bankAccountNumber -recipientId
                     -reviews 
                     `)
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

                const isOnline = userId
                    ? this.socketService.isOnline(userId.toString())
                    : false;

                return {
                    ...teacher,
                    userId,
                    profileImage,
                    isOnline
                };
            })
        );

        return {
            data: teachersWithStats,
            total,
            page,
            limit,
        };
    }


    async getTeacherProfileMine(
        teacherId: string
    ): Promise<Record<string, any>> {
        const teacher = await this.findTeacher(teacherId);
        if (!teacher) throw new NotFoundException('ไม่พบข้อมูลผู้ใช้');

        await teacher.populate([
            { path: 'subjects' },
            { path: 'userId', select: '_id profileImage' },
        ]);

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
            isOnline
        };
    }


    async getTeacherProfileById(
        teacherId: string
    ): Promise<Record<string, any>> {
        if (!Types.ObjectId.isValid(teacherId)) {
            throw new BadRequestException('รหัสของครูไม่ถูกต้อง');
        }

        const teacher = await this.teacherModel
            .findById(new Types.ObjectId(teacherId))
            .select(`
                     -idCardWithPerson -bankName
                     -bankAccountName -bankAccountNumber -recipientId
                     `)
            .populate([
                { path: 'subjects' },
                { path: 'userId', select: '_id profileImage' },
            ])
            .lean();

        if (!teacher) throw new NotFoundException('ไม่พบข้อมูลผู้ใช้');

        const userId = teacher.userId?._id ?? null;
        const profileImage = (teacher.userId as any)?.profileImage ?? null;

        const isOnline = userId
            ? this.socketService.isOnline(userId.toString())
            : false;

        return {
            ...teacher,
            userId,
            profileImage,
            isOnline
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

        const updated = await this.teacherModel
            .findOneAndUpdate(
                { userId: new Types.ObjectId(userId) },
                { $set: updateData },
                { new: true }
            )

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
                console.log(`[getStream] upsert verified teacher_${userId} successful`);
            } catch (err) {
                console.warn('[getStream] Failed to upsert teacher:', err.message);
            }
        }

        return updated;
    }


    //Revice Section
    async addReview(
        teacherId: string,
        reviewerId: string,
        body: reviewTeacherDto
    ): Promise<any> {
        const teacher = await this.teacherModel.findById(teacherId);
        if (!teacher) throw new NotFoundException('ไม่พบครู');

        const alreadyReviewed = teacher.reviews.find(
            (r) => r.reviewerId.toString() === reviewerId
        );
        if (alreadyReviewed) throw new BadRequestException('คุณได้รีวิวครูคนนี้ไปแล้ว');

        const reviewrObjId = new Types.ObjectId(reviewerId)

        const hasStudy = await this.slotModel.findOne({
            teacherId: teacher._id,
            bookedBy: reviewrObjId,
            status: 'studied'
        })

        if (!hasStudy) throw new BadRequestException('คุณยังไม่เคยเรียนกับครูคนนี้')

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

        return {
            averageRating: teacher.averageRating,
            reviewCount: teacher.reviewCount,
            satisfactionRate: teacher.satisfactionRate,
        }
    }


    async deleteReview(
        teacherId: string,
        reviewerId: string
    ): Promise<any> {
        const teacher = await this.teacherModel.findById(teacherId);
        if (!teacher) throw new NotFoundException('ไม่พบครู');

        const reviewIndex = teacher.reviews.findIndex(
            (r) => r.reviewerId.toString() === reviewerId
        );
        if (reviewIndex === -1) {
            throw new NotFoundException('ไม่พบรีวิวของคุณในครูคนนี้');
        }

        teacher.reviews.splice(reviewIndex, 1);

        if (teacher.reviews.length > 0) {
            const total = teacher.reviews.reduce((sum, r) => sum + r.rating, 0);
            teacher.reviewCount = teacher.reviews.length;
            teacher.averageRating = total / teacher.reviewCount;
            teacher.satisfactionRate = Math.round((teacher.averageRating / 5) * 100);
        } else {
            teacher.reviewCount = 0;
            teacher.averageRating = 0;
            teacher.satisfactionRate = 0;
        }

        await teacher.save();

        return teacher
    }

}

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Teacher, TeacherDocument } from './schemas/teacher.schema';
import { S3Service } from 'src/infra/s3/s3.service';
import { reviewTeacherDto, UpdateTeacherBankDto, UpdateTeacherDto } from './schemas/teacher.zod.schema';
import { Slot, SlotDocument } from '../slots/schemas/slot.schema';


@Injectable()
export class TeachersService {
    constructor(
        private readonly s3Service: S3Service,
        @InjectModel(Teacher.name) private teacherModel: Model<TeacherDocument>,
        @InjectModel(Slot.name) private slotModel: Model<SlotDocument>
    ) { }

    private async findTeacher(userId: string): Promise<TeacherDocument | null> {
        return this.teacherModel.findOne({ userId: new Types.ObjectId(userId) });
    }

    private async getTeachingStats(teacherId: string | Types.ObjectId) {
        const id = new Types.ObjectId(teacherId);

        const [stats] = await this.slotModel.aggregate([
            {
                $match: {
                    teacherId: id,
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                    totalHours: {
                        $sum: {
                            $divide: [
                                { $subtract: ["$endTime", "$startTime"] },
                                1000 * 60 * 60
                            ]
                        }
                    }
                }
            }
        ]);
        if (!stats) return { count: 0, totalHours: 0 };
        return stats;
    }


    async createTeacherProfile(
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


    async updateIdCardImage(
        userId: string,
        file: Express.Multer.File,
    ): Promise<string> {
        const teacher = await this.findTeacher(userId)
        if (!teacher) throw new NotFoundException('ไม่พบครูในระบบ');

        if (teacher.isVerified === true) {
            throw new BadRequestException('บัญชีได้รับการยืนยันแล้ว ไม่สามารถอัปโหลดบัตรประชาชนได้');
        }

        const filePath = `teacher/${userId}/id-card`;
        const publicFileUrl = await this.s3Service.uploadPublicReadFile(
            file,
            filePath,
        );

        teacher.idCard = publicFileUrl;
        await teacher.save();

        return publicFileUrl;
    }


    async updateIdCardWithPerson(
        userId: string,
        file: Express.Multer.File,
    ): Promise<string> {
        const teacher = await this.findTeacher(userId)
        if (!teacher) throw new NotFoundException('ไม่พบครูในระบบ');

        if (teacher.isVerified === true) {
            throw new BadRequestException('บัญชีได้รับการยืนยันแล้ว ไม่สามารถอัปโหลดบัตรประชาชนได้');
        }

        const filePath = `teacher/${userId}/id-card-with-person`;
        const publicFileUrl = await this.s3Service.uploadPublicReadFile(
            file,
            filePath,
        );

        teacher.idCardWithPerson = publicFileUrl;
        await teacher.save();

        return publicFileUrl;
    }


    async updateCertificate(
        userId: string,
        files: Express.Multer.File[],
    ): Promise<string[]> {
        const teacher = await this.findTeacher(userId)
        if (!teacher) throw new NotFoundException('ไม่พบครูในระบบ');

        if (teacher.isVerified === true) {
            throw new BadRequestException('บัญชีได้รับการยืนยันแล้ว ไม่สามารถอัปโหลดบัตรประชาชนได้');
        }

        const filePath = `teacher/${userId}/certificate`;

        const publicFileUrls = await Promise.all(
            files.map(file => this.s3Service.uploadPublicReadFile(file, filePath)),
        );

        teacher.certificate = publicFileUrls;
        await teacher.save();

        return publicFileUrls;
    }


    async getAllTeacher(): Promise<TeacherDocument[]> {
        return this.teacherModel.find()
    }


    async getTeachers(
        search?: string,
        sort?: 'rating' | 'priceAsc' | 'priceDesc',
        page = 1,
        limit = 10,
    ): Promise<any> {
        const query: any = {};

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
                .select(`
                    -idCard -idCardWithPerson -bankName
                     -bankAccountName -bankAccountNumber
                     `)
                .sort(sortOption)
                .skip(skip)
                .limit(limit)
                .lean(),
            this.teacherModel.countDocuments(query),
        ]);

        const teachersWithStats = await Promise.all(
            teachers.map(async (teacher) => {
                const stats = await this.getTeachingStats(teacher._id);
                return {
                    ...teacher,
                    teachingCount: stats?.count,
                    teachingHours: stats?.totalHours,
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

        await teacher.populate('subject');
        const stats = await this.getTeachingStats(teacher._id);

        return {
            ...teacher.toObject(),
            teachingCount: stats.count,
            teachingHours: stats.totalHours,
        };
    }


    async getTeacherProfileById(
        teacherId: string
    ): Promise<Record<string, any>> {
        if (!Types.ObjectId.isValid(teacherId)) {
            throw new BadRequestException('รหัสของครูไม่ถูกต้อง');
        }
        const teacher = await this.teacherModel.findById(new Types.ObjectId(teacherId))
        if (!teacher) throw new NotFoundException('ไม่พบข้อมูลผู้ใช้');

        await teacher.populate('subject');
        const stats = await this.getTeachingStats(teacher._id);

        return {
            ...teacher.toObject(),
            teachingCount: stats.count,
            teachingHours: stats.totalHours,
        };
    }


    async updateTeacherProfile(
        userId: string,
        body: UpdateTeacherDto,
    ): Promise<Teacher> {
        const teacher = await this.findTeacher(userId);
        if (!teacher) throw new NotFoundException('ไม่พบข้อมูลครู');

        if (body.subject) {
            (body as any).subject = new Types.ObjectId(body.subject);
        }

        Object.assign(teacher, body);
        await teacher.save();

        return teacher;
    }


    async updateBank(
        userId: string,
        body: UpdateTeacherBankDto
    ) {
        const teacher = await this.findTeacher(userId);
        if (!teacher) throw new NotFoundException('ไม่พบข้อมูลครู');

        teacher.bankName = body.bankName;
        teacher.bankAccountName = body.bankAccountName;
        teacher.bankAccountNumber = body.bankAccountNumber;
        await teacher.save();

        return teacher;
    }


    async verifyTeacher(teacherId: string) {
        if (!isValidObjectId(teacherId)) {
            throw new BadRequestException('ไอดีของครูไม่ถูกต้อง')
        }

        const teacher = await this.teacherModel.findById(teacherId);
        if (!teacher) throw new NotFoundException('ไม่พบครูในระบบ');

        if (teacher.isVerified) {
            throw new BadRequestException('บัญชีนี้ยืนยันตัวตนเรียบร้อยแล้ว');
        }

        teacher.isVerified = true;
        await teacher.save();

        return teacher
    }


    async rejectTeacher(teacherId: string) {
        if (!isValidObjectId(teacherId)) {
            throw new BadRequestException('ไอดีของครูไม่ถูกต้อง');
        }

        const teacher = await this.teacherModel.findById(teacherId);
        if (!teacher) throw new NotFoundException('ไม่พบครูในระบบ');

        if (teacher.isVerified) {
            throw new BadRequestException('ครูคนนี้ได้รับการยืนยันแล้ว ไม่สามารถปฏิเสธได้');
        }

        teacher.idCard = null;
        teacher.idCardWithPerson = null;
        teacher.certificate = [];

        await teacher.save();

        return teacher;
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

        teacher.reviews.push({
            reviewerId: new Types.ObjectId(reviewerId),
            rating: body.rating,
            comment: body.comment
        });

        const total = teacher.reviews.reduce((sum, r) => sum + r.rating, 0);
        const count = teacher.reviews.length;
        teacher.averageRating = total / count;
        teacher.reviewCount = count;

        await teacher.save();

        return { teacher };
    }

}

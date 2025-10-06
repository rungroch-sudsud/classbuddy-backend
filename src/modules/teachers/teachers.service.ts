import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Teacher, TeacherDocument } from './schemas/teacher.schema';
import { S3Service } from 'src/infra/s3/s3.service';


@Injectable()
export class TeachersService {
    constructor(@InjectModel(Teacher.name) private teacherModel: Model<TeacherDocument>,
        private readonly s3Service: S3Service
    ) { }

    private async findTeacher(userId: string): Promise<TeacherDocument | null> {
        return this.teacherModel.findOne({ userId: new Types.ObjectId(userId) });
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
        sort?: 'recommend' | 'rating' | 'priceAsc' | 'priceDesc',
        page = 1,
        limit = 10,
    ): Promise<any> {
        const query: any = {};

        if (search && search.trim() !== '') {
            query.$or = [
                { 'userId.name': { $regex: search, $options: 'i' } },
                { 'userId.lastName': { $regex: search, $options: 'i' } },
                { skills: { $regex: search, $options: 'i' } },
            ];
        }

        let sortOption = {};
        switch (sort) {
            case 'rating':
                sortOption = { rating: -1 };
                break;
            case 'priceAsc':
                sortOption = { hourlyRate: 1 };
                break;
            case 'priceDesc':
                sortOption = { hourlyRate: -1 };
                break;
            default:
                sortOption = { recommendScore: -1 };
        }

        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.teacherModel
                .find(query)
                .sort(sortOption)
                .skip(skip)
                .limit(limit),
            this.teacherModel.countDocuments(query),
        ]);

        return {
            data,
            total,
            page,
            limit,
        };
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


}

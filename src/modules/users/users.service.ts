import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Teacher, TeacherDocument } from './schemas/teacher.schema';
import { s3Service } from 'src/infra/s3';


@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(Teacher.name) private teacherModel: Model<TeacherDocument>,
    ) { }


    async createProfile(
        phone: string,
        passwordHash: string
    ) {
        return this.userModel.create({
            phone,
            password: passwordHash,
        });
    }


    async findByPhone(phone: string) {
        return this.userModel.findOne({ phone }).exec();
    }


    async updateProfile(
        userId: string,
        body: any,
    ): Promise<any> {
        const update = await this.userModel.findByIdAndUpdate(
            userId,
            {
                $set: {
                    name: body.name,
                    lastName: body.lastName,
                    nickName: body.nickName,
                    age: body.age,
                    subject: body.subject,
                },
            },
            { new: true },
        );

        if (!update) throw new NotFoundException('User not found');

        return update;
    }


    async updateProfileImage(
        userId: string,
        file: Express.Multer.File,
    ): Promise<any> {
        const user = await this.userModel.findById(userId);
        if (!user) throw new NotFoundException('ไม่พบผู้ใช้งาน');

        const filePath = `users/${userId}/profile-image`;
        const publicFileUrl = await s3Service.uploadPublicReadFile(
            file,
            filePath,
        );

        user.profileImage = publicFileUrl;
        await user.save();

        return publicFileUrl;

    }


    async createTeachProfile(
        userId: string,
        body: any
    ): Promise<TeacherDocument> {
        const exist = await this.teacherModel.findOne({ userId: new Types.ObjectId(userId) });
        if (exist) throw new ConflictException('Teacher profile already exists');

        const createTeacher = new this.teacherModel({
            ...body,
            userId: new Types.ObjectId(userId)
        });
        return createTeacher.save();
    }


    async findAll(): Promise<Teacher[]> {
        return this.teacherModel.find().populate('userId', 'name lastName');
    }

}

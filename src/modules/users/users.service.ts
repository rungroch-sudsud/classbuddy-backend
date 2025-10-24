import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { UpdateProfileDto } from './schemas/user.zod.schema';
import { S3Service } from 'src/infra/s3/s3.service';
import { Teacher, TeacherDocument } from '../teachers/schemas/teacher.schema';


@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(Teacher.name) private teacherModel: Model<TeacherDocument>,
        private readonly s3Service: S3Service
    ) { }


    async createProfile(
        phone: string,
        passwordHash: string
    ): Promise<any> {
        return this.userModel.create({
            phone,
            password: passwordHash,
        });
    }


    async findByPhone(phone: string): Promise<any> {
        return this.userModel.findOne({ phone }).exec();
    }


    async updateProfile(
        userId: string,
        body: UpdateProfileDto,
    ): Promise<UserDocument> {
        const update = await this.userModel.findByIdAndUpdate(
            userId,
            { $set: body },
            { new: true },
        )
            .select('-password -phone');

        if (!update) throw new NotFoundException('User not found');

        return update;
    }


    async updateProfileImage(
        userId: string,
        file: Express.Multer.File,
    ): Promise<string> {
        const user = await this.userModel.findById(userId);
        if (!user) throw new NotFoundException('ไม่พบผู้ใช้งาน');
console.log('[Upload]', file?.originalname, file?.size, file?.mimetype);

        const filePath = `users/${userId}/profile-image`;
        const publicFileUrl = await this.s3Service.uploadPublicReadFile(
            file,
            filePath,
        );

        user.profileImage = publicFileUrl;
        await user.save();

        // if (user.role === 'teacher') {
        //     const teacher = await this.teacherModel.findOne({ 
        //         userId: new Types.ObjectId(userId)
        //      });

        //     if (teacher) {
        //         teacher.profileImage = publicFileUrl;
        //         await teacher.save();
        //     }
        // }

        return publicFileUrl;
    }


    async getUserProfileMine(
        userId: string
    ): Promise<Record<string, any>> {
        const user = await this.userModel
            .findById(new Types.ObjectId(userId))
            .select('-password')
            .populate('subjects')

        if (!user) throw new NotFoundException('ไม่พบข้อมูลผู้ใช้');
        return user;
    }


    async toggleBookmark(userId: string, slotId: string) {
        const user = await this.userModel.findById(userId);
        if (!user) throw new NotFoundException('ไม่พบผู้ใช้');

        const index = user.bookmarks.indexOf(slotId);
        let bookmarked: boolean;

        if (index > -1) {
            user.bookmarks.splice(index, 1);
            bookmarked = false;
        } else {
            user.bookmarks.push(slotId);
            bookmarked = true;
        }

        await user.save();

        return { bookmarked, bookmarks: user.bookmarks };
    }


    async updatePasswordByPhone(
        phone: string,
        newHashedPassword: string
    ): Promise<any> {
        const user = await this.userModel.findOneAndUpdate(
            { phone },
            { password: newHashedPassword },
            { new: true },
        );

        if (!user) {
            throw new NotFoundException('ไม่พบผู้ใช้งานที่มีเบอร์นี้');
        }

        return user;
    }



}

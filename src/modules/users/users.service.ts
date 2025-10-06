import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { UpdateProfileDto } from './schemas/user.zod.schema';
import { S3Service } from 'src/infra/s3/s3.service';


@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
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


    async findByPhone(phone: string) {
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

        const filePath = `users/${userId}/profile-image`;
        const publicFileUrl = await this.s3Service.uploadPublicReadFile(
            file,
            filePath,
        );

        user.profileImage = publicFileUrl;
        await user.save();

        return publicFileUrl;
    }



}

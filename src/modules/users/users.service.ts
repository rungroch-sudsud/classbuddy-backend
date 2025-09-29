import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import * as bcrypt from 'bcrypt';


@Injectable()
export class UsersService {
    constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) { }


    async createProfile(
        phone: string,
        passwordHash: string
    ) {
        const user = new this.userModel(phone, passwordHash);
        return user.save();
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
            { $set: body },
            { new: true },
        );
        if (!update) throw new NotFoundException('User not found');

        return update;

    }


    async updateProfileImage(
        userId: string,
        file: Express.Multer.File,
    ): Promise<any> {

        const user = this.userModel.findById(userId);

        if (!user) {
            throw new NotFoundException('ไม่พบผู้ใช้งาน');
        }

        // if (user.user_ !== firebaseUserId) {
        //     throw new ForbiddenException('คุณไม่มีสิทธิ์อัพเดตรูปภาพของ user นี้');
        // }

        const filePath = `users/${userId}/profile-image`;
        // const publicFileUrl = await s3Service.uploadPublicReadFile(
        //     file,
        //     filePath,
        // );

        // user.profileImageUrl = publicFileUrl;
        // await user.save();

        // return publicFileUrl;

    }

}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from './schemas/user.schema';
import { UpdateProfileDto } from './schemas/user.zod.schema';
import { S3Service } from 'src/infra/s3/s3.service';
import { StreamChatService } from '../chat/stream-chat.service';


@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name) private userModel: Model<User>,
        private readonly s3Service: S3Service,
        private readonly streamChatService: StreamChatService
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
    ): Promise<User> {
        const update = await this.userModel.findByIdAndUpdate(
            userId,
            { $set: body },
            { new: true },
        )
            .select('-password -phone -role');

        if (!update) throw new NotFoundException('ไม่พบผู้ใช้งาน');

        try {
            await this.streamChatService.upsertUser({
                id: `${userId}`,
                name: `${update.name ?? ''} ${update.lastName ?? ''}`.trim(),
                image: update.profileImage ?? undefined
            });

        } catch (err) {
            console.warn('[GETSTREAM] Failed to upsert Stream user:', err.message);
        }
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

        try {
            await this.streamChatService.partialUpdateUser({
                id: `${userId}`,
                set: { image: publicFileUrl },
            });
        } catch (err) {
            console.warn('[GETSTREAM] Failed to upsert image:', err.message);
        }

        return publicFileUrl;
    }


    async getUserProfileMine(
        userId: string
    ): Promise<User> {
        const user = await this.userModel
            .findById(new Types.ObjectId(userId))
            .select('-password')
            .populate('subjects')

        if (!user) throw new NotFoundException('ไม่พบข้อมูลผู้ใช้');
        return user;
    }


    async toggleBookmark(
        userId: string,
        slotId: string
    ): Promise<{ bookmarked: boolean; bookmarks: string[] }> {
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

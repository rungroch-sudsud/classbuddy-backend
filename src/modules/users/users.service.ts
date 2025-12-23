import {
    BadRequestException,
    ConflictException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from './schemas/user.schema';
import { UpdateProfileDto } from './schemas/user.zod.schema';
import { S3Service } from 'src/infra/s3/s3.service';
import { StreamChatService } from '../chat/stream-chat.service';
import { Wallet } from '../payments/schemas/wallet.schema';
import { Teacher } from '../teachers/schemas/teacher.schema';
import {
    createObjectId,
    errorLog,
    getErrorMessage,
    infoLog,
    isProductionEnv,
} from 'src/shared/utils/shared.util';
import { SmsService } from 'src/infra/sms/sms.service';

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name) private userModel: Model<User>,
        @InjectModel(Wallet.name) private walletModel: Model<Wallet>,
        @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
        private readonly s3Service: S3Service,
        private readonly streamChatService: StreamChatService,
        private readonly smsService: SmsService,
    ) {}

    private async createUserWalletIfNotExists(userId: string): Promise<void> {
        const user = await this.userModel.findById(userId);
        if (!user) throw new BadRequestException('ไม่พบผู้ใช้คนนี้');

        const userObjId = new Types.ObjectId(userId);

        const existingWallet = await this.walletModel.findOne({
            userId: userObjId,
            role: 'user',
        });

        if (existingWallet) return;

        const wallet = new this.walletModel({
            userId: userObjId,
            role: 'user',
        });

        await wallet.save();
    }

    async createProfile(phone: string, passwordHash: string): Promise<any> {
        return this.userModel.create({
            phone,
            password: passwordHash,
        });
    }

    async deleteAccount(userId: string): Promise<void> {
        const user = await this.userModel.findById(userId);
        if (!user) throw new NotFoundException('ไม่พบผู้ใช้งาน');

        await user.deleteOne();

        if (isProductionEnv())
            await this.smsService.sendSms(
                ['0611752168', '0853009999'],
                'มีผู้ใช้งานลบบัญชี 1 ท่าน',
            );
    }

    async findByPhone(phone: string): Promise<any> {
        return this.userModel.findOne({ phone }).exec();
    }

    async updateProfile(userId: string, body: UpdateProfileDto): Promise<User> {
        const currentUser = await this.userModel.findById(userId);
        if (!currentUser) throw new NotFoundException('ไม่พบผู้ใช้งาน');

        if (body.email && body.email !== currentUser.email) {
            const exists = await this.userModel.findOne({
                email: body.email,
                _id: { $ne: userId },
            });

            if (exists) throw new ConflictException('อีเมลนี้มีผู้ใช้งานแล้ว');
        }

        const update = await this.userModel
            .findByIdAndUpdate(userId, { $set: body }, { new: true })
            .select('-password -phone -role');

        if (!update) throw new NotFoundException('ไม่พบผู้ใช้งาน');

        await this.teacherModel.findOneAndUpdate(
            { userId: createObjectId(userId) },
            { $set: { name: body.name, lastName: body.lastName } },
        );

        await this.createUserWalletIfNotExists(userId);

        try {
            await this.streamChatService.upsertUser({
                id: `${userId}`,
                name: `${update.name ?? ''} ${update.lastName ?? ''}`.trim(),
                image: update.profileImage ?? undefined,
            });

            console.log(
                `[GETSTREAM] upsert user in getStream ${userId} ${update.name} `,
            );
        } catch (err) {
            console.warn(
                '[GETSTREAM] Failed to upsert Stream user:',
                err.message,
            );
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

    async getUserProfileMine(userId: string): Promise<any> {
        const userObjId = new Types.ObjectId(userId);

        const user = await this.userModel
            .findById(userObjId)
            .select('-password')
            .populate('subjects')
            .populate({
                path: 'bookmarks',
                model: 'Teacher',
                select: `
    name lastName subjects customSubjects
    averageRating reviewCount totalTeachingHours
    hourlyRate verifyStatus userId
  `,
                populate: [
                    {
                        path: 'subjects',
                        model: 'SubjectList',
                        select: 'name',
                    },
                    {
                        path: 'userId',
                        model: 'User',
                        select: 'profileImage',
                    },
                ],
            })

            .lean();

        if (!user) throw new NotFoundException('ไม่พบข้อมูลผู้ใช้');

        const wallet = await this.walletModel
            .findOne({ userId: userObjId, role: 'user' })
            .select('availableBalance')
            .lean();

        user.bookmarks = (user.bookmarks as any[]).map((bookmark: any) => {
            const profileImage =
                bookmark.userId && typeof bookmark.userId === 'object'
                    ? bookmark.userId.profileImage
                    : null;

            const { userId, ...rest } = bookmark;

            return {
                ...rest,
                profileImage,
            };
        });

        return {
            ...user,
            wallet: wallet ?? null,
        };
    }

    async toggleBookmark(
        userId: string,
        teacherId: string,
    ): Promise<{ bookmarked: boolean; bookmarks: string[] }> {
        const user = await this.userModel.findById(userId);
        if (!user) throw new NotFoundException('ไม่พบผู้ใช้');

        const index = user.bookmarks.indexOf(teacherId);
        let bookmarked: boolean;

        if (index > -1) {
            user.bookmarks.splice(index, 1);
            bookmarked = false;
        } else {
            user.bookmarks.push(teacherId);
            bookmarked = true;
        }

        await user.save();

        return { bookmarked, bookmarks: user.bookmarks };
    }

    async updatePasswordByPhone(
        phone: string,
        newHashedPassword: string,
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

    async syncUserExpoPushToken(
        userId: string,
        pushToken: string,
    ): Promise<void> {
        try {
            const user = await this.userModel.findById(userId);

            if (!user) throw new NotFoundException('ไม่พบข้อมูล user ดังกล่าว');

            user.expoPushToken = pushToken;
            await user.save();

            infoLog(
                'USER SERVICE',
                `อัปเดต expo push token สำหรับ userId : ${userId} สำเร็จ!`,
            );
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);

            errorLog(
                'USER SERVICE',
                `ล้มเหลวระหว่าง update expo push token -> ${errorMessage}`,
            );

            throw new InternalServerErrorException(
                'ล้มเหลวระหว่าง update expo push token',
            );
        }
    }
}

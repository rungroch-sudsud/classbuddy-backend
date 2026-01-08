import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import { Model } from 'mongoose';
import { envConfig } from 'src/configs/env.config';
import { SmsMessageBuilder } from 'src/infra/sms/builders/sms-builder.builder';
import { SmsService } from 'src/infra/sms/sms.service';
import {
    createObjectId,
    errorLog,
    getErrorMessage,
    infoLog,
    isProductionEnv,
} from 'src/shared/utils/shared.util';
import { Teacher } from '../teachers/schemas/teacher.schema';
import { User } from '../users/schemas/user.schema';
import {
    CreatePostDto,
    CreateProposalDto,
    UpdatePostDto,
} from './dto/post.dto';
import { Post } from './schemas/post.schema';
import { NotificationsService } from '../notifications/notifications.service';

dayjs.locale('th');

@Injectable()
export class PostsService {
    private readonly logEntity: string = 'POST SERVICE';

    constructor(
        @InjectModel(User.name) private readonly userModel: Model<User>,
        @InjectModel(Post.name) private readonly postModel: Model<Post>,
        @InjectModel(Teacher.name)
        private readonly teacherModel: Model<Teacher>,
        private readonly smsService: SmsService,
        private readonly notificationService: NotificationsService,
    ) {}

    async createPost(createPostDto: CreatePostDto, studentUserId: string) {
        try {
            infoLog(
                this.logEntity,
                `กำลังสร้างโพสต์หาคุณครูสำหรับนักเรียน studentId : ${studentUserId}`,
            );

            const student = await this.userModel.findById(studentUserId);

            if (!student)
                throw new NotFoundException('ไม่พบข้อมูลนักเรียนดังกล่าว');

            const newPost = await this.postModel.create({
                detail: createPostDto.detail,
                createdBy: student._id,
            });

            const users = await this.userModel.find({});
            const userHavingPushTokens = users.filter(
                (user) => user.expoPushToken.length > 0,
            );
            const userNotHavingPushTokens = users.filter(
                (user) => user.expoPushToken.length <= 0,
            );

            const userPhones: Array<string> = userNotHavingPushTokens.map(
                (user) => user.phone,
            );
            const userPushTokens: Array<string> = userHavingPushTokens.flatMap(
                (user) => user.expoPushToken,
            );

            const builder = new SmsMessageBuilder();

            builder
                .addText('มีโพสประกาศหาคุณครู 1 รายการ')
                .newLine()
                .addText(`รายละเอียด : ${newPost.detail}`)
                .newLine()
                .addText(
                    `ดูรายละเอียดได้ที่ : ${envConfig.frontEndUrl}/job-board`,
                );

            const message = builder.getMessage();

            if (isProductionEnv()) {
                await this.smsService.sendSms(userPhones, message);

                await this.notificationService.notify({
                    expoPushTokens: userPushTokens,
                    title: 'มีโพสประกาศหาคุณครู 1 รายการ ✨',
                    body: `${newPost.detail}`,
                    data: {
                        link: `${envConfig.frontEndUrl}/job-board`,
                    },
                });
            }

            infoLog(
                this.logEntity,
                `สร้างโพสต์หาคุณครูสำหรับ นักเรียน studentId : ${studentUserId} สำเร็จ!`,
            );

            return {
                data: newPost,
                message: 'สร้างโพสสำเร็จ',
            };
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);

            errorLog(
                this.logEntity,
                `ล้มเหลวะระหว่างสร้างโพสต์หาคุณครู -> ${errorMessage}`,
            );

            throw error;
        }
    }

    async getAll(page: number = 1): Promise<any> {
        const limit = 8;

        if (page < 1) page = 1;
        const skip = (page - 1) * limit;

        const posts = await this.postModel
            .find({ closedAt: null })
            .skip(skip)
            .limit(limit)
            .populate({
                path: 'createdBy',
                select: 'name lastName profileImage role',
            })
            .populate({
                path: 'proposals.teacherId',
                select: 'name lastName userId verifyStatus',
                populate: {
                    path: 'userId',
                    select: 'profileImage',
                },
            })
            .sort({ createdAt: -1 })
            .lean();

        posts.forEach((post) => {
            const p = post as any;
            p.createdAt = dayjs(p.createdAt).format('D MMMM YYYY');

            p.proposals = p.proposals.map((proposal: any) => {
                const teacher = proposal.teacherId;

                const profileImage =
                    teacher && typeof teacher.userId === 'object'
                        ? teacher.userId.profileImage
                        : null;

                const { userId, ...restTeacher } = teacher;

                proposal.teacherId = {
                    ...restTeacher,
                    profileImage,
                };

                return proposal;
            });
        });

        const total = await this.postModel.countDocuments({ closedAt: null });

        return {
            items: posts,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page * limit < total,
            hasPrevPage: page > 1,
        };
    }

    async updatePost(
        userId: string,
        postId: string,
        body: UpdatePostDto,
    ): Promise<any> {
        const post = await this.postModel.findById(postId);
        if (!post) throw new NotFoundException('ไม่มีโพสต์นี้');

        if (post.createdBy.toString() !== userId) {
            throw new ForbiddenException('คุณไม่มีสิทธิ์แก้ไขโพสต์นี้');
        }

        if (!body || Object.keys(body).length === 0) {
            throw new BadRequestException('ไม่มีการแก้ไข');
        }

        if (post.closedAt)
            throw new BadRequestException('โพสต์นี้ถูกปิดไปแล้ว');

        const updated = await this.postModel.findByIdAndUpdate(
            postId,
            { $set: body },
            { new: true },
        );

        return updated;
    }

    async closePost(userId: string, postId: string): Promise<void> {
        const post = await this.postModel.findById(postId);
        if (!post) throw new NotFoundException('ไม่มีโพสต์นี้');

        if (post.createdBy.toString() !== userId) {
            throw new ForbiddenException('คุณไม่มีสิทธิ์แก้ไขโพสต์นี้');
        }

        if (post.closedAt)
            throw new BadRequestException('โพสต์นี้ถูกปิดไปแล้ว');

        await this.postModel.findByIdAndUpdate(
            postId,
            { $set: { closedAt: new Date() } },
            { new: true },
        );
    }

    async deletePost(userId: string, postId: string): Promise<void> {
        const post = await this.postModel.findById(postId);
        if (!post) throw new NotFoundException('ไม่มีโพสต์นี้');

        if (post.createdBy.toString() !== userId) {
            throw new ForbiddenException('คุณไม่มีสิทธิ์ลบโพสต์นี้');
        }

        await this.postModel.deleteOne({ _id: postId });
    }

    async getPostById(postId: string): Promise<any> {
        const post = await this.postModel
            .findOne({ _id: postId, closedAt: null })
            .populate({
                path: 'createdBy',
                select: 'name lastName profileImage role',
            })
            .populate({
                path: 'proposals.teacherId',
                select: 'name lastName userId verifyStatus',
                populate: {
                    path: 'userId',
                    select: 'profileImage',
                },
            })
            .lean();

        if (!post) throw new Error('ไม่พบโพสต์นี้หรือถูกปิดแล้ว');

        const p = post as any;

        return {
            ...p,
            createdAt: dayjs(p.createdAt).format('D MMMM YYYY'),
            proposals:
                p.proposals?.map((x: any) => ({
                    ...x,
                    createdAt: dayjs(x.createdAt).format('D MMMM YYYY HH:mm'),
                })) ?? [],
        };
    }

    async addProposal(
        postId: string,
        userId: string,
        body: CreateProposalDto,
    ): Promise<Post> {
        const teacher = await this.teacherModel
            .findOne({
                userId: createObjectId(userId),
            })
            .lean();

        if (!teacher) throw new BadRequestException('ไม่มีครูคนนี้');

        if (teacher.verifyStatus !== 'verified') {
            throw new ForbiddenException('บัญชึของคุณยังไม่ได้รับการยืนยัน');
        }

        const post = await this.postModel.findById(postId);
        if (!post) throw new NotFoundException('ไม่พบโพสต์นี้');

        if (post.createdBy.toString() === userId) {
            throw new ForbiddenException('คุณไม่สามารถเสนอโพสต์ของตัวเองได้');
        }

        if (post.closedAt)
            throw new BadRequestException('โพสต์นี้ถูกปิดไปแล้ว');

        const teacherHasAlreadyProposed = post.proposals.some(
            (p) => p.teacherId.toString() === teacher._id.toString(),
        );

        if (teacherHasAlreadyProposed)
            throw new BadRequestException('คุณได้เสนอไปแล้ว');

        post.proposals.push({
            teacherId: teacher._id,
            ...body,
        });

        const updatedPost = await post.save();

        const student = await this.userModel.findById(updatedPost.createdBy);
        if (!student)
            throw new NotFoundException('ไม่พบข้อมูลนักเรียนดังกล่าว');

        const builder = new SmsMessageBuilder();

        builder
            .addText('มีคุณครูเสนอสอนโพสของคุณ 1 ท่าน')
            .newLine()
            .addText(
                `รายละเอียด : https://www.classbuddy.online/job-board/${updatedPost._id.toString()}`,
            );

        const message = builder.getMessage();

        await this.smsService.sendSms(student.phone, message);

        return updatedPost;
    }

    async deleteProposal(postId: string, userId: string): Promise<Post> {
        const teacher = await this.teacherModel
            .findOne({ userId: createObjectId(userId) })
            .lean();
        if (!teacher) throw new BadRequestException('ไม่มีครูคนนี้');

        const post = await this.postModel.findById(postId);

        if (!post) throw new NotFoundException('ไม่พบโพสต์นี้');

        if (post.closedAt)
            throw new BadRequestException('โพสต์นี้ถูกปิดไปแล้ว');

        post.proposals = post.proposals.filter(
            (p) => p.teacherId.toString() !== teacher._id.toString(),
        );

        const updatedPost = await post.save();

        return updatedPost;
    }
}

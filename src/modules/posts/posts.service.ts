import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePostDto, CreateProposalDto, UpdatePostDto } from './dto/post.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '../users/schemas/user.schema';
import { Model, Types } from 'mongoose';
import { Post } from './schemas/post.schema';
import {
    errorLog,
    getErrorMessage,
    infoLog,
} from 'src/shared/utils/shared.util';
import { Teacher } from '../teachers/schemas/teacher.schema';
import dayjs from "dayjs";
import "dayjs/locale/th";

dayjs.locale("th");

@Injectable()
export class PostsService {
    private readonly logEntity: string = 'POST SERVICE';

    constructor(
        @InjectModel(User.name) private readonly userModel: Model<User>,
        @InjectModel(Post.name) private readonly postModel: Model<Post>,
        @InjectModel(Teacher.name) private readonly teacherModel: Model<Teacher>,
    ) { }

    async createPost(
        createPostDto: CreatePostDto,
        studentUserId: string
    ) {
        try {
            infoLog(
                this.logEntity,
                `กำลังสร้างโพสต์หาคุณครูสำหรับนักเรียน studentId : ${studentUserId}`,
            );

            const student = await this.userModel.findById(studentUserId);

            if (!student) throw new NotFoundException('ไม่พบข้อมูลนักเรียนดังกล่าว');

            const newPost = await this.postModel.create({
                detail: createPostDto.detail,
                createdBy: student._id,
            });

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


    async getAll(
        page: number = 1,
    ): Promise<any> {
        const limit = 8;

        if (page < 1) page = 1;
        const skip = (page - 1) * limit;

        const posts = await this.postModel
            .find({ closedAt: null })
            .skip(skip)
            .limit(limit)
            .populate({
                path: 'createdBy',
                select: 'name lastName profileImage role'
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

        posts.forEach(post => {
            const p = post as any;
            p.createdAt = dayjs(p.createdAt).format("D MMMM YYYY");

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

        if (post.closedAt) throw new BadRequestException('โพสต์นี้ถูกปิดไปแล้ว');

        const updated = await this.postModel.findByIdAndUpdate(
            postId,
            { $set: body },
            { new: true }
        );

        return updated;
    }


    async closePost(
        userId: string,
        postId: string
    ): Promise<void> {
        const post = await this.postModel.findById(postId);
        if (!post) throw new NotFoundException('ไม่มีโพสต์นี้');

        if (post.createdBy.toString() !== userId) {
            throw new ForbiddenException('คุณไม่มีสิทธิ์แก้ไขโพสต์นี้');
        }

        if (post.closedAt) throw new BadRequestException('โพสต์นี้ถูกปิดไปแล้ว');

        await this.postModel.findByIdAndUpdate(
            postId,
            { $set: { closedAt: new Date() } },
            { new: true }
        );
    }


    async deletePost(
        userId: string,
        postId: string
    ): Promise<void> {
        const post = await this.postModel.findById(postId);
        if (!post) throw new NotFoundException('ไม่มีโพสต์นี้');

        if (post.createdBy.toString() !== userId) {
            throw new ForbiddenException('คุณไม่มีสิทธิ์ลบโพสต์นี้');
        }

        await this.postModel.deleteOne({ _id: postId });
    }

    async getPostById(
        postId: string
    ): Promise<any> {
        const post = await this.postModel
            .findOne({ _id: postId, closedAt: null })
            .populate({
                path: 'createdBy',
                select: 'name lastName profileImage role'
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
            createdAt: dayjs(p.createdAt).format("D MMMM YYYY"),
            proposals: p.proposals?.map((x: any) => ({
                ...x,
                createdAt: dayjs(x.createdAt).format("D MMMM YYYY HH:mm"),
            })) ?? []
        };
    }


    //Teacher Section
    async addProposal(
        postId: string,
        userId: string,
        body: CreateProposalDto
    ): Promise<any> {
        const teacher = await this.teacherModel.findOne({
            userId: new Types.ObjectId(userId)
        });

        if (!teacher) throw new BadRequestException('ไม่มีครูคนนี้');

        if (teacher.verifyStatus !== 'verified') {
            throw new ForbiddenException('บัญชึของคุณยังไม่ได้รับการยืนยัน');
        }

        const exist = await this.postModel.exists({
            _id: postId,
            'proposals.teacherId': teacher._id,
        });

        if (exist) throw new BadRequestException('คุณได้เสนอไปแล้ว');

        return await this.postModel.findByIdAndUpdate(
            postId,
            {
                $push: {
                    proposals: {
                        teacherId: teacher._id,
                        ...body,
                    },
                },
            },
            { new: true }
        );
    }

}

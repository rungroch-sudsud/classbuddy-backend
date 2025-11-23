import {
    BadRequestException,
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
    createObjectId,
    errorLog,
    getErrorMessage,
    infoLog,
} from 'src/shared/utils/shared.util';
import { Teacher } from '../teachers/schemas/teacher.schema';
import { User } from '../users/schemas/user.schema';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { Post } from './schemas/post.schema';

@Injectable()
export class PostsService {
    private readonly logEntity: string = 'POST SERVICE';

    constructor(
        @InjectModel(User.name) private readonly userModel: Model<User>,
        @InjectModel(Post.name) private readonly postModel: Model<Post>,
        @InjectModel(Teacher.name)
        private readonly teacherModel: Model<Teacher>,
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

    async createProposal(
        createProposalDto: CreateProposalDto,
        teacherUserId: string,
        postId: string,
    ) {
        try {
            infoLog(
                this.logEntity,
                `กำลังสร้างโพสต์หาคุณครูสำหรับนักเรียน teacherUserId : ${teacherUserId}`,
            );

            const teacher = await this.teacherModel
                .findOne({
                    userId: createObjectId(teacherUserId),
                })
                .lean();

            if (!teacher)
                throw new NotFoundException('ไม่พบข้อมูลคุณครูดังกล่าว');

            if (teacher.verifyStatus !== 'verified')
                throw new UnauthorizedException(
                    'กรุณายืนยันตัวตนก่อนเสนองานในโพสต์',
                );

            const existingPost = await this.postModel.findById(postId);

            if (!existingPost)
                throw new NotFoundException('ไม่พบโพสต์ดังกล่าว');

            const alreadyPosted = existingPost.proposals.some(
                (proposal) => proposal.teacherId.toString() === teacher._id.toString(),
            );

            if (alreadyPosted)
                throw new BadRequestException('คุณได้ทำการเสนอ โพสต์นี้่แล้ว');

            const newProposal = {
                teacherId: teacher._id,
                detail: createProposalDto.detail,
            };

            existingPost.proposals.push(newProposal);

            await existingPost.save();

            infoLog(
                this.logEntity,
                `เสนองานในโพสต์ postId : ${postId} จาก teacherUserId : ${teacherUserId} สำเร็จ!`,
            );

            return {
                data: newProposal,
                message: 'เสนองานสำเร็จ',
            };
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);

            errorLog(
                this.logEntity,
                `ล้มเหลวระหว่างเสนองาน -> ${errorMessage}`,
            );

            throw error;
        }
    }
}

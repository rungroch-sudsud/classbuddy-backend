import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '../users/schemas/user.schema';
import { Model } from 'mongoose';
import { Post } from './schemas/post.schema';
import {
    errorLog,
    getErrorMessage,
    infoLog,
} from 'src/shared/utils/shared.util';

@Injectable()
export class PostsService {
    private readonly logEntity: string = 'POST SERVICE';

    constructor(
        @InjectModel(User.name) private readonly userModel: Model<User>,
        @InjectModel(Post.name) private readonly postModel: Model<Post>,
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

            infoLog(this.logEntity, `สร้างโพสต์หาคุณครูสำหรับ นักเรียน studentId : ${studentUserId} สำเร็จ!`)

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

            return { data: null, message: 'ล้มเหลวระหว่างสร้างโพสต์หาคุณครู' };
        }
    }
}

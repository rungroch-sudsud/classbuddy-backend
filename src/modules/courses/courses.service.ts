import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { S3Service } from 'src/infra/s3/s3.service';
import {
    createObjectId,
    devLog,
    errorLog,
    getErrorMessage,
    infoLog,
} from 'src/shared/utils/shared.util';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { Course, CourseDocument } from './schemas/course.schema';
import { Teacher, TeacherDocument } from '../teachers/schemas/teacher.schema';

@Injectable()
export class CoursesService {
    private readonly logEntity: string = 'COURSE SERVICE';

    constructor(
        @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
        @InjectModel(Teacher.name) private teacherModel: Model<TeacherDocument>,
        private readonly s3Service: S3Service,
    ) {}

    async create(userId: string, createCourseDto: CreateCourseDto) {
        try {
            const teacher = await this.teacherModel.findOne({
                userId: createObjectId(userId),
            });

            if (!teacher) {
                throw new NotFoundException('ไม่พบข้อมูลครู');
            }

            const createdCourse = await this.courseModel.create({
                subjectId: createObjectId(createCourseDto.subjectId),
                courseName: createCourseDto.courseName,
                courseGoal: createCourseDto.courseGoal,
                courseTotalHours: createCourseDto.courseTotalHours,
                price: createCourseDto.price,
                courseDetail: createCourseDto.courseDetail,
                issueCertificate: createCourseDto.issueCertificate,
                teacherId: teacher._id,
                createdBy: createObjectId(userId),
            });

            infoLog(
                this.logEntity,
                `[CREATE COURSE SUCCESS] -> ${createdCourse}`,
            );

            return createdCourse;
        } catch (error) {
            if (error instanceof NotFoundException) throw error;

            const errorMessage = getErrorMessage(error);

            errorLog(
                this.logEntity,
                `[CREATE COURSE ERROR] -> ${errorMessage}`,
            );

            throw new InternalServerErrorException(
                'เกิดข้อผิดพลาดในการสร้างคอร์สเรียน',
            );
        }
    }

    async findAll() {
        return this.courseModel.find();
    }

    async findOne(id: string) {
        const course = await this.courseModel.findById(id);

        if (!course) {
            throw new NotFoundException(`Course with ID ${id} not found`);
        }
        return course;
    }

    async update(userId: string, id: string, updateCourseDto: UpdateCourseDto) {
        const course = await this.findOne(id);

        if (course.createdBy.toString() !== userId) {
            throw new BadRequestException('คุณไม่มีสิทธิ์แก้ไขคอร์สนี้');
        }

        const updatedCourse = await this.courseModel
            .findByIdAndUpdate(id, updateCourseDto, { new: true })
            .exec();

        return updatedCourse;
    }

    async remove(userId: string, id: string) {
        const course = await this.findOne(id);

        if (course.createdBy.toString() !== userId) {
            throw new BadRequestException('คุณไม่มีสิทธิ์ลบคอร์สนี้');
        }

        const result = await this.courseModel.findByIdAndDelete(id).exec();
        return result;
    }

    async updateCourseImage(
        userId: string,
        courseId: string,
        courseImageFile: Express.Multer.File,
    ) {
        const course = await this.courseModel.findById(courseId);

        if (!course) throw new NotFoundException('ไม่พบข้อมูลคอร์สดังกล่าว');

        if (course.createdBy.toString() !== userId) {
            throw new BadRequestException('คุณไม่มีสิทธิ์แก้ไขคอร์สนี้');
        }

        const newCourseImageUrl = await this.s3Service.uploadPublicReadFile(
            courseImageFile,
            `courses/${courseId}`,
            courseImageFile.filename,
        );

        course.courseImageUrl = newCourseImageUrl;

        await course.save();

        return course;
    }
}

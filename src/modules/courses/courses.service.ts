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
import { CourseStatus } from './enums/course.enum';
import { SubjectList } from '../subjects/schemas/subject.schema';
import {
    CourseWithSubject,
    CourseWithTeacherAndSubject,
} from './schemas/populated-course.schema';

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
                courseGoals: createCourseDto.courseGoals,
                courseTotalHours: createCourseDto.courseTotalHours,
                price: createCourseDto.price,
                courseDetail: createCourseDto.courseDetail,
                issueCertificate: createCourseDto.issueCertificate,
                status: createCourseDto.status,
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

    async getAvailableCourses() {
        try {
            const courses = await this.courseModel
                .find({ status: CourseStatus.PUBLISHED })
                .populate('subjectId')
                .populate({
                    path: 'teacherId',
                    populate: {
                        path: 'userId',
                        select: 'name lastName profileImage',
                    },
                })
                .lean<Array<CourseWithTeacherAndSubject>>();

            devLog('courses', courses);

            return courses;
        } catch (error) {
            const errorMessage = getErrorMessage(error);
            errorLog(
                this.logEntity,
                `[GET AVAILABLE COURSES ERROR] -> ${errorMessage}`,
            );
            throw error;
        }
    }

    async getMyCreatedCourses(userId: string) {
        try {
            const courses = await this.courseModel
                .find({
                    createdBy: createObjectId(userId),
                })
                .populate('subjectId')
                .lean<Array<CourseWithSubject>>();

            const formattedCourses = courses.map((course) => {
                const subjectId = course.subjectId._id.toString();
                const subject = course.subjectId;

                return {
                    ...course,
                    subjectId,
                    subject,
                };
            });

            devLog('formattedCourse', formattedCourses);

            return formattedCourses;
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);

            errorLog(
                this.logEntity,
                `[GET MY CREATED COURSES ERROR] -> ${errorMessage}`,
            );

            throw error;
        }
    }

    async findOne(courseId: string) {
        const course = await this.courseModel.findById(courseId);

        if (!course) {
            throw new NotFoundException(`Course with ID ${courseId} not found`);
        }
        return course;
    }

    async update(
        userId: string,
        courseId: string,
        updateCourseDto: UpdateCourseDto,
    ) {
        const course = await this.findOne(courseId);

        if (course.createdBy.toString() !== userId) {
            throw new BadRequestException('คุณไม่มีสิทธิ์แก้ไขคอร์สนี้');
        }

        const updatedCourse = await this.courseModel.findByIdAndUpdate(
            courseId,
            updateCourseDto,
            { new: true },
        );

        return updatedCourse;
    }

    async remove(userId: string, courseId: string) {
        const course = await this.findOne(courseId);

        if (course.createdBy.toString() !== userId)
            throw new BadRequestException('คุณไม่มีสิทธิ์ลบคอร์สนี้');

        const deletedCourse =
            await this.courseModel.findByIdAndDelete(courseId);

        return deletedCourse;
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

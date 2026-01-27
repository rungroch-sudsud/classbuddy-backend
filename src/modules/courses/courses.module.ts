import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { S3Module } from 'src/infra/s3/s3.module';
import { Teacher, TeacherSchema } from '../teachers/schemas/teacher.schema';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { Course, CourseSchema } from './schemas/course.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Course.name, schema: CourseSchema },
            { name: Teacher.name, schema: TeacherSchema },
        ]),
        S3Module,
    ],
    controllers: [CoursesController],
    providers: [CoursesService],
})
export class CoursesModule {}

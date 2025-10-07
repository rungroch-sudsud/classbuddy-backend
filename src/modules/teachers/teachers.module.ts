import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Teacher, TeacherSchema } from './schemas/teacher.schema';
import { TeachersController } from './teachers.controller';
import { TeachersService } from './teachers.service';
import { S3Module } from 'src/infra/s3/s3.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Teacher.name, schema: TeacherSchema },
        ]),
        S3Module
    ],
    providers: [TeachersService],
    controllers: [TeachersController],
    exports: [TeachersService, MongooseModule],
})

export class TeachersModule { }

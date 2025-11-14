import { Module } from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { SubjectsController } from './subjects.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { SubjectList, SubjectSchema } from './schemas/subject.schema';
import { S3Module } from 'src/infra/s3/s3.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SubjectList.name, schema: SubjectSchema },
    ]),
    S3Module
  ],
  providers: [SubjectsService],
  controllers: [SubjectsController],
  exports: [SubjectsService],
})
export class SubjectsModule { }

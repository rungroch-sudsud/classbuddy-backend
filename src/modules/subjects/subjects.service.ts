import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SubjectList, SubjectListDocument } from './schema/subject.schema';
import { Model } from 'mongoose';
import { S3Service } from 'src/infra/s3/s3.service';



@Injectable()
export class SubjectsService {
    constructor(
        @InjectModel(SubjectList.name) private subjectModel: Model<SubjectListDocument>,
        private readonly s3Service: S3Service
    ) { }


    async createSubject(
        name: string,
        file: Express.Multer.File,
    ): Promise<any> {
        const exist = await this.subjectModel.findOne({ name });
        if (exist) throw new ConflictException(`ชื่อวิชา "${name}" มีอยู๋แล้ว`);

        const imageUrl = await this.s3Service.uploadPublicReadFile(
            file,
            `subjects/file-${Date.now()}`
        );

        const subject = new this.subjectModel({
            name,
            file: imageUrl,
        });

        return subject.save();
    }


    async getAllSubject():Promise<SubjectListDocument[]> {
        return this.subjectModel.find()

    }



}

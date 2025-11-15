import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SubjectRequest } from './schemas/subject-request.schema';
import { Model } from 'mongoose';

@Injectable()
export class SubjectrequestsService {
    constructor(
        @InjectModel(SubjectRequest.name)
        private subjectRequestModel: Model<SubjectRequest>,
    ) {}

    async createSubjectRequest(subjectName: string): Promise<void> {
        await this.subjectRequestModel.insertOne({ name: subjectName });
    }
}

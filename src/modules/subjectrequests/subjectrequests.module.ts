import { Module } from '@nestjs/common';
import { SubjectrequestsService } from './subjectrequests.service';
import { SubjectrequestsController } from './subjectrequests.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
    SubjectRequest,
    SubjectRequestSchema,
} from './schemas/subject-request.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: SubjectRequest.name, schema: SubjectRequestSchema },
        ]),
    ],
    controllers: [SubjectrequestsController],
    providers: [SubjectrequestsService],
})
export class SubjectrequestsModule {}

import { Body, Controller, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { getErrorMessage } from 'src/shared/utils/shared.util';
import { CreateSubjectRequestDto } from './schemas/subject-request.zod.schema';
import { SubjectrequestsService } from './subjectrequests.service';
import type { Response } from 'express';

@ApiTags('Subject Requests')
@Controller('subject-requests')
export class SubjectrequestsController {
    constructor(
        private readonly subjectrequestsService: SubjectrequestsService,
    ) {}

    @Post()
    @ApiOperation({ summary: 'เพิ่มวิชาที่ต้องการ Request' })
    async createSubjectRequest(
        @Body() body: CreateSubjectRequestDto,
        @Res() res: Response,
    ) {
        try {
            await this.subjectrequestsService.createSubjectRequest(body.name);

            res.status(HttpStatus.CREATED).json({
                message: 'Request วิชาสำเร็จ',
                data: null,
            });
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(
                error,
                'เกิดข้อผิดพลาดระหว่าง Request วิชา',
            );

            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: errorMessage,
                data: null,
            });
        }
    }
}

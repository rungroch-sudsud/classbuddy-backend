import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import z from 'zod/v3';

export const CreateBlackListSchema = z.object({
    platform: z
        .string()
        .min(1, { message: 'กรุณากรอก platform ที่เจอมิจฉาชีพ' }),
    scammerUsername: z
        .string()
        .min(1, { message: 'กรุณากรอก username ของมิจฉาชีพ' }),
});

export class CreateBlacklistDto extends createZodDto(CreateBlackListSchema) {
    @ApiProperty({
        type: 'array',
        items: { type: 'string', format: 'binary' },
        description: 'รูปภาพหลักฐาน',
    })
    evidences: Array<any>;
}

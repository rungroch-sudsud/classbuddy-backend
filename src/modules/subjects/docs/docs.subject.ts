import { ApiProperty } from '@nestjs/swagger';

export class CreateSubjectDocs {
    @ApiProperty({ example: 'คณิตศาสตร์' })
    name: string;

    @ApiProperty({ type: 'string', format: 'binary' })
    file: any;
}
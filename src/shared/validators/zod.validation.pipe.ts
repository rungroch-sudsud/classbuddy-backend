import {
    PipeTransform,
    BadRequestException,
    ArgumentMetadata,
} from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

export class ZodValidationPipe implements PipeTransform {
    constructor(private schema?: ZodSchema) {}

    transform(value: any, metadata: ArgumentMetadata) {
        const targetSchema: ZodSchema | undefined =
            this.schema ?? (metadata.metatype as any)?.schema;

        if (targetSchema) {
            const parsed = targetSchema.safeParse(value);

            if (!parsed.success) {
                const zodError = parsed.error as ZodError;

                const firstErrorMessage = zodError.issues.at(0)?.message;
                throw new BadRequestException({
                    error: 'VALIDATION_FAILED',
                    message: firstErrorMessage ?? 'ข้อมูลไม่ถูกต้อง',
                    hints: zodError.issues.map((e) => e.message),
                    data: null,
                });
            }

            return parsed.data;
        }

        return value;
    }
}

export class ZodFilePipe implements PipeTransform {
    constructor(private readonly schema: ZodSchema<any>) {}

    transform(file?: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException({
                error: 'VALIDATION_FAILED',
                message: 'ไฟล์รูปไม่ถูกต้อง',
                hints: ['กรุณาแนบไฟล์รูปภาพ'],
                data: null,
            });
        }

        const result = this.schema.safeParse({
            mimetype: file.mimetype,
            size: file.size,
        });

        if (!result.success) {
            throw new BadRequestException({
                error: 'VALIDATION_FAILED',
                message: 'ไฟล์รูปไม่ถูกต้อง',
                hints: result.error.issues.map((i) => i.message),
                data: null,
            });
        }

        return file;
    }
}

export class ZodFilesPipe implements PipeTransform {
    constructor(private readonly schema: ZodSchema<any>) {}

    transform(input: Express.Multer.File[] | Express.Multer.File | undefined) {
        if (!input) {
            throw new BadRequestException({
                error: 'VALIDATION_FAILED',
                message: 'ไม่พบไฟล์',
                hints: ['กรุณาแนบไฟล์อย่างน้อย 1 ไฟล์'],
                data: null,
            });
        }

        const files = Array.isArray(input) ? input : [input];

        const result = this.schema.safeParse(
            files.map((f) => ({ mimetype: f.mimetype, size: f.size })),
        );

        if (!result.success) {
            throw new BadRequestException({
                error: 'VALIDATION_FAILED',
                message: 'ไฟล์ไม่ถูกต้อง',
                hints: result.error.issues.map((i) => i.message),
                data: null,
            });
        }

        return files;
    }
}

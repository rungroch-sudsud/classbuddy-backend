import { PipeTransform, BadRequestException, ArgumentMetadata } from '@nestjs/common';
import type { ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema?: ZodSchema) { }

  transform(
    value: any,
    metadata: ArgumentMetadata
  ) {
    if (this.schema) {
      const parsed = this.schema.safeParse(value);

      if (!parsed.success) {
        throw new BadRequestException({
          error: 'VALIDATION_FAILED',
          message: 'ข้อมูลไม่ถูกต้อง',
        //   hints: parsed.error.errors.map((i) => i.message),
          data: null,
        });
      }

      return parsed.data;
    }

    if (metadata.metatype && (metadata.metatype as any).schema) {
      const dtoSchema: ZodSchema = (metadata.metatype as any).schema;
      const parsed = dtoSchema.safeParse(value);
      if (!parsed.success) {
        throw new BadRequestException({
          error: 'VALIDATION_FAILED',
          message: 'ข้อมูลไม่ถูกต้อง',
        //   hints: parsed.error.errors.map((i) => i.message),
          data: null,
        });
      }
      return parsed.data;
    }

    return value;

  }
}



export class ZodFilePipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema<any>) { }

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


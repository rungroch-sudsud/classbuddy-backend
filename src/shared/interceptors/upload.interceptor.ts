// src/common/interceptors/upload.interceptor.ts
import {
    applyDecorators,
    BadRequestException,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

export function UploadInterceptor(
    fieldName: string,
    maxCount = 1,
    fileSizeMB = 10,
    allowedTypes: ('image' | 'pdf')[] = ['image'],
) {
    const multerOptions = {
        storage: memoryStorage(),
        limits: { fileSize: fileSizeMB * 1024 * 1024 },
        fileFilter: (req, file, callback) => {
          return callback(null, true);
            const isImage = file.mimetype.match(/^image\/(jpeg|png|webp)$/);
            const isPdf = file.mimetype === 'application/pdf';

            const allowImage = allowedTypes.includes('image');
            const allowPdf = allowedTypes.includes('pdf');

            if ((allowImage && isImage) || (allowPdf && isPdf)) {
                return callback(null, true);
            }

            let message = '';
            if (allowImage && !allowPdf) {
                message = 'รองรับเฉพาะไฟล์รูปภาพเท่านั้น (jpeg, png, webp)';
            } else if (!allowImage && allowPdf) {
                message = 'รองรับเฉพาะไฟล์ PDF เท่านั้น';
            } else {
                message = 'File type not allowed. Only image or PDF supported.';
            }

            return callback(new BadRequestException(message), false);
        },
    };

    if (maxCount === 1) {
        return applyDecorators(
            UseInterceptors(FileInterceptor(fieldName, multerOptions)),
        );
    }

    return applyDecorators(
        UseInterceptors(FilesInterceptor(fieldName, maxCount, multerOptions)),
    );
}

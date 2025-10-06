// src/common/interceptors/upload.interceptor.ts
import { applyDecorators, BadRequestException, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

export function UploadInterceptor(
  fieldName: string,
  maxCount = 1,
  fileSizeMB = 5,
  allowedTypes: ('image' | 'pdf')[] = ['image']
) {
  const multerOptions = {
    storage: memoryStorage(),
    limits: { fileSize: fileSizeMB * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
      const isImage = file.mimetype.match(/^image\/(jpeg|png|webp)$/);
      const isPdf = file.mimetype === 'application/pdf';

      if (
        (allowedTypes.includes('image') && isImage) ||
        (allowedTypes.includes('pdf') && isPdf)
      ) {
        return callback(null, true);
      }

      return callback(
        new BadRequestException(
          `File type not allowed. Only ${allowedTypes.join(', ')} supported.`,
        ),
        false,
      );
    },
  };

  if (maxCount === 1) {
    return applyDecorators(UseInterceptors(FileInterceptor(fieldName, multerOptions)));
  }

  return applyDecorators(UseInterceptors(FilesInterceptor(fieldName, maxCount, multerOptions)));
}

import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

export function UploadInterceptor(
  fieldName: string,
  maxCount = 1,
  fileSizeMB = 5,
) {
  if (maxCount === 1) {
    return applyDecorators(
      UseInterceptors(
        FileInterceptor(fieldName, {
          storage: memoryStorage(),
          limits: { fileSize: fileSizeMB * 1024 * 1024 },
        }),
      ),
    );
  }

  return applyDecorators(
    UseInterceptors(
      FilesInterceptor(fieldName, maxCount, {
        storage: memoryStorage(),
        limits: { fileSize: fileSizeMB * 1024 * 1024 },
      }),
    ),
  );
}

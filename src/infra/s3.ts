import { PutObjectAclCommand, PutObjectCommand, S3 } from '@aws-sdk/client-s3';
import { HttpStatus } from '@nestjs/common';
import { envConfig } from 'src/configs/env.config';

const BUCKET_NAME = 'not-along-bucket';
const DIGITAL_OCEAN_REGION = 'sgp1';

const s3Client = new S3({
  forcePathStyle: false,
  endpoint: `https://${DIGITAL_OCEAN_REGION}.digitaloceanspaces.com`,
  region: 'us-east-1',
  credentials: {
    accessKeyId:  process.env.DIGITAL_OCEAN_SPACES_KEY!,
    secretAccessKey:process.env.DIGITAL_OCEAN_SPACES_SECRET!,
  },
});

class S3Service {
  constructor(private readonly s3Client: S3) {
    if (!this.s3Client) {
      throw new Error('S3 client is not initialized');
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    filePath: string,
    fileName: string | undefined = undefined,
  ): Promise<string> {
    const filePathWithFileName = `${filePath}/${fileName ?? file.originalname}`;

    const input = {
      Body: file.buffer,
      Bucket: BUCKET_NAME,
      Key: filePathWithFileName,
    };

    const command = new PutObjectCommand(input);

    const response = await this.s3Client.send(command);

    if (response.$metadata.httpStatusCode !== HttpStatus.OK) {
      throw new Error('Failed to upload file');
    }

    return filePathWithFileName;
  }

  async uploadPublicReadFile(
    file: Express.Multer.File,
    filePath: string,
    fileName: string | undefined = undefined,
  ): Promise<string> {
    const filePathWithFileName = await this.uploadFile(
      file,
      filePath,
      fileName,
    );

    await this.grantPublicRead(filePathWithFileName);

    return this.getPublicFileUrl(filePathWithFileName);
  }

  async grantPublicRead(filePath: string): Promise<void> {
    const command = new PutObjectAclCommand({
      Bucket: BUCKET_NAME,
      Key: filePath,
      ACL: 'public-read',
    });

    const response = await this.s3Client.send(command);

    if (response.$metadata.httpStatusCode !== HttpStatus.OK) {
      throw new Error('Failed to grant public read');
    }
  }

  getPublicFileUrl(
    filePathWithFileName: string,
    isViaCdn: boolean = true,
  ): string {
    return `https://${BUCKET_NAME}.${DIGITAL_OCEAN_REGION}${isViaCdn && '.cdn'}.digitaloceanspaces.com/${filePathWithFileName}`;
  }
}

const s3Service = new S3Service(s3Client);

export { s3Service };

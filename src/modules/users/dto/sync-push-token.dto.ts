import { createZodDto } from 'nestjs-zod';
import z from 'zod/v3';

export const SyncPushTokenSchema = z.object({
    expoPushToken: z
        .string({ message: 'กรุณาระบุ push token' })
        .min(1, { message: 'กรุณาระบุ push token' })
        .max(60, { message: 'ความยาว push token ไม่ควรจะยาวขนาดนี้' }),
});

export class SyncPushTokenDto extends createZodDto(SyncPushTokenSchema) {}

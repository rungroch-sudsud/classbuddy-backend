import { PaymentMethod } from '../schemas/payment.schema';

export interface PaymentStrategy {
    method: PaymentMethod;

    pay({
        bookingId,
        currentUserId,
        receiptFile,
    }: {
        bookingId: string;
        currentUserId: string;
        receiptFile?: Express.Multer.File;
    }): Promise<void>;
}

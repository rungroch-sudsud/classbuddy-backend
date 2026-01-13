import { isProductionEnv } from 'src/shared/utils/shared.util';

export const businessConfig = {
    bankAccountName: 'บจก. รุ่งโรจน์สุดสุด',
    payments: {
        maxBankTransferRetries: 3,
        maxBankTransferTTL: 1000 * 60 * 60, // : 1 ชั่วโมง
        maximumBookingExpiryTime: 1000 * 60 * 15, // : 15 นาที
        expiryMinutes: isProductionEnv() ? 15 : 2,
    },
    coFounderPhones: ['0611752168', '0853009999'],
    classroom: {
        freeTrialMinutes: 30,
        maximumMontlyFreeTrials: 3,
    },
};

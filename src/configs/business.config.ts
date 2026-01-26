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
        maximumClassShortNoteLength: 200,
    },
    course: {
        minimumHours: 1,
        maximumHours: 1000,
        minimumPriceBaht: 100,
        maximumPriceBaht: 1000000,
    },
};


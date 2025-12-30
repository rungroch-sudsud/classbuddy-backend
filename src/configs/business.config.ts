export const businessConfig = {
    bankAccountName: 'บจก. รุ่งโรจน์สุดสุด',
    payments: {
        maxBankTransferRetries: 3,
        maxBankTransferTTL: 1000 * 60 * 60, // : 1 ชั่วโมง
        maximumBookingExpiryTime: 1000 * 60 * 15, // : 15 นาที
    },
};

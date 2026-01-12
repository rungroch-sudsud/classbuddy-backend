export const BookingStatusList = [
    'pending', // : กำลังจ่ายเงินอยู่
    'available',
    'paid',
    'studied',
    'canceled',
    'teacher_confirm_pending', // : รอการยืนยันจากครู
    'expired',
] as const;

export type BookingStatus = (typeof BookingStatusList)[number];

export const BookingTypeList = ['free_trial', 'require_payment'] as const;

export type BookingType = (typeof BookingTypeList)[number];

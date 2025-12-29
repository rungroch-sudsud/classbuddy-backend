export const BookingStatusList = [
    'pending',
    'available',
    'paid',
    'studied',
    'canceled',
    'teacher_confirm_pending', // : รอการยืนยันจากครู
    'expired',
] as const;

export type BookingStatus = (typeof BookingStatusList)[number];

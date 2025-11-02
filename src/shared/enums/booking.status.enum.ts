export const BookingStatusList = [
    'pending',
    'available',
    'paid',
    'studied',
    'rejected',
    'expired',
] as const;

export type BookingStatus = typeof BookingStatusList[number];

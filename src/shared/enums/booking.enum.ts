export const BookingStatusList = [
    'pending',
    'available',
    'paid',
    'studied',
    'canceled',
    'expired',
] as const;

export type BookingStatus = (typeof BookingStatusList)[number];

export enum CreateBookingMethod {
    OMISE = 'omise',
    WALLET = 'wallet',
}

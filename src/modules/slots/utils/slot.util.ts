import { Slot } from '../schemas/slot.schema';

export function getSlotDuartionHours(slot: Slot): number {
    const oneHourInMilSeconds = 1000 * 60 * 60;

    const timeDiffInMilSeconds =
        slot.endTime.getTime() - slot.startTime.getTime();

    const durationHours = timeDiffInMilSeconds / oneHourInMilSeconds;

    return durationHours;
}

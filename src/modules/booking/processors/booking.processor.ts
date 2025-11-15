import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('booking')
export class BookingProcessor extends WorkerHost {
    async process(job: Job) {}
}

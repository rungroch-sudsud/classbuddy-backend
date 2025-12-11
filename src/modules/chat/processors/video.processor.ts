import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BullMQJob } from 'src/shared/enums/bull-mq.enum';
import { errorLog, getErrorMessage } from 'src/shared/utils/shared.util';
import { VideoService } from '../video.service';

@Processor('video')
export class VideoProcessor extends WorkerHost {
    constructor(private readonly videoService: VideoService) {
        super();
    }

    async process(job: Job) {
        if (job.name === BullMQJob.CREATE_CALLROOM) {
            const logEntity = 'QUEUE (CREATE_CALLROOM)';

            try {
                const data: { bookingId: string } = job.data;
                const bookingId = data.bookingId;

                await this.videoService.createCallRoom(bookingId);

                return { success: true };
            } catch (error: unknown) {
                const errorMesage = getErrorMessage(error);

                errorLog(logEntity, errorMesage);

                return { success: false };
            }
        }
    }
}

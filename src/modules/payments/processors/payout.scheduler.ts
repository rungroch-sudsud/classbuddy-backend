import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';


@Injectable()
export class PayoutScheduler implements OnModuleInit {
  constructor(@InjectQueue('payout') private readonly payoutQueue: Queue) {}

  async onModuleInit() {
    try {
      const existing = await this.payoutQueue.getRepeatableJobs();
      for (const job of existing) {
        if (job.name === 'weekly-payout') {
          await this.payoutQueue.removeRepeatableByKey(job.key);
        }
      }
    } catch (e) {
 
    }

    await this.payoutQueue.add(
      'weekly-payout',
      {},
      {
        repeat: {
          pattern: '32 11 15 10 *',
          tz: 'Asia/Bangkok',
        },
        jobId: 'weekly-payout',
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    console.log('Weekly payout scheduled: every Wednesday 09:00 (Asia/Bangkok)');
  }
}

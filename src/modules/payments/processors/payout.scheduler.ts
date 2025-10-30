import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';


@Injectable()
export class PayoutScheduler implements OnModuleInit {
  constructor(@InjectQueue('payout') private readonly payoutQueue: Queue) { }

  async onModuleInit() {
    try {
      const existing = await this.payoutQueue.getRepeatableJobs();
      for (const job of existing) {
        if (job.name === 'weekly-payout') {
          await this.payoutQueue.removeRepeatableByKey(job.key);
        }
      }
    } catch (e) {
      console.warn('[PayoutScheduler] Failed to clear existing jobs:', e.message);
    }

    await this.payoutQueue.add(
      'weekly-payout',
      {},
      {
        repeat: {
          pattern: '1 0 * * 2',
          tz: 'Asia/Bangkok',
        },
        jobId: 'weekly-payout',
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
    console.log('[PayoutScheduler] Weekly payout every Tuesday 00:01 (Asia/Bangkok)');
  }
}

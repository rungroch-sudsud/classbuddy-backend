import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { Wallet } from '../schemas/wallet.schema';
import { Teacher } from 'src/modules/teachers/schemas/teacher.schema';
import { PayoutLog } from '../schemas/payout.schema';
import { PaymentsService } from '../payments.service';
import { ModuleRef } from '@nestjs/core';

const Omise = require('omise');


@Processor('payout')
export class PayoutProcessor extends WorkerHost {
    private omise: any;
    private paymentsService: PaymentsService;

    constructor(
        @InjectConnection() private readonly connection: Connection,
        @InjectModel(Wallet.name) private walletModel: Model<Wallet>,
        @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
        @InjectModel(PayoutLog.name) private payoutLogModel: Model<PayoutLog>,
        private moduleRef: ModuleRef,

    ) {
        super();
        const secretKey = process.env.OMISE_SECRET_KEY;
        const publicKey = process.env.OMISE_PUBLIC_KEY;
        this.omise = Omise({ secretKey, publicKey });
    }

    async onModuleInit() {
        this.paymentsService = this.moduleRef.get(PaymentsService, { strict: false });
    }

    async process(job: Job) {
        if (job.name === 'weekly-payout') {
            const result = await this.paymentsService.payoutTeachers();
            return { success: true, queued: result.queued };
        }

        if (job.name === 'payout-job') {
            const data = job.data;
            const session = await this.connection.startSession();
            console.log(`Processing payout for teacher ${data.name} ${data.lastName}`);

            try {
                await session.withTransaction(async () => {

                    const transfer = await this.omise.transfers.create({
                        recipient: data.recipientId,
                        amount: Math.floor(data.teacherNet * 100),
                        description: `Payout for ${data.name}`,
                        metadata: {
                            teacherId: data.teacherId,
                            walletId: data.walletId,
                            payoutLogId: data.payoutLogId,
                        }
                    },
                        {
                            headers: { 'Idempotency-Key': data.payoutLogId }
                        }
                    );

                    await this.payoutLogModel.updateOne(
                        { _id: data.payoutLogId },
                        {
                            $set: {
                                status: 'processing',
                                transferId: transfer.id,
                            },
                        },
                        { session },
                    );
                    console.log(`Created payout transfer for ${data.name}, waiting Omise webhook...`);
                });

                return { success: true };

            } catch (err) {
                // await this.walletModel.updateOne(
                //     { _id: data.walletId },
                //     {
                //         $inc: { availableBalance: data.totalAmount },
                //         $set: { lockedBalance: 0 },
                //     },
                // );

                // await this.payoutLogModel.updateOne(
                //     { _id: data.payoutLogId },
                //     {
                //         $set: {
                //             status: 'failed',
                //             errorMessage: err.message,
                //         },
                //     },
                // );

                console.error(`Payout failed for ${data.name}:`, err.message);
                await this.payoutLogModel.updateOne(
                    { _id: data.payoutLogId },
                    { $set: { status: 'wait_for_confirm', errorMessage: err.message } },
                );

                throw err;

            } finally {
                await session.endSession();
            }
        }
    }

}
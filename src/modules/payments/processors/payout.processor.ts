import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
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
            console.log('Running weekly payout job...');
            const result = await this.paymentsService.payoutTeachers();
            console.log(`Queued ${result.queued} teachers for payout.`);
            return { success: true, queued: result.queued };
        }

        if (job.name === 'payout-job') {
            const data = job.data;
            console.log(`🎯 Processing payout for ${data.name} ${data.lastName}`);
            const session = await this.connection.startSession();
            try {
                await session.withTransaction(async () => {
                    let recipientId = data.recipientId;

                    if (!recipientId) {
                        console.log(`🧾 Creating Omise recipient for ${data.name}`);
                        const recipient = await this.omise.recipients.create({
                            name: `${data.name} ${data.lastName}`,
                            type: 'individual',
                            bank_account: {
                                brand: data.bankName.toLowerCase(),
                                number: data.bankAccountNumber,
                                name: data.bankAccountName,
                            },
                        });

                        recipientId = recipient.id;

                        await this.teacherModel.updateOne(
                            { _id: data.teacherId },
                            { $set: { recipientId } },
                            { session },
                        );
                    }

                    const transfer = await this.omise.transfers.create({
                        recipient: recipientId,
                        amount: Math.floor(data.teacherNet * 100),
                        description: `Payout for ${data.name}`,
                        metadata: {
                            teacherId: data.teacherId,
                            walletId: data.walletId,
                            payoutLogId: data.payoutLogId,
                        },
                    });

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

            } catch (error) {
                console.error(`Payout failed for ${data.name}:`, error.message);

                await this.walletModel.updateOne(
                    { _id: data.walletId },
                    {
                        $inc: { availableBalance: data.totalAmount },
                        $set: { lockedBalance: 0 },
                    },
                );

                await this.payoutLogModel.updateOne(
                    { _id: data.payoutLogId },
                    {
                        $set: {
                            status: 'failed',
                            errorMessage: error.message,
                        },
                    },
                );
                throw error;
            } finally {
                await session.endSession();
                console.log(`🔚 Session closed for ${data.name}`);
            }
        }
    }
}
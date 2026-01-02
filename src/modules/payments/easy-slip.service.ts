import { HttpStatus, Injectable } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import { envConfig } from 'src/configs/env.config';
import { devLog } from 'src/shared/utils/shared.util';

export interface VerifyReceiptResponse {
    status: number;
    data: {
        payload: string;
        transRef: string;
        date: string;
        countryCode: string;
        amount: {
            amount: number;
            local: {
                amount?: number;
                currency?: string;
            };
        };
        fee?: number;
        ref1?: string;
        ref2?: string;
        ref3?: string;
        sender: {
            bank: {
                id?: string;
                name?: string;
                short?: string;
            };
            account: {
                name: {
                    th?: string;
                    en?: string;
                };
                bank?: {
                    type: 'BANKAC' | 'TOKEN' | 'DUMMY';
                    account: string;
                };
                proxy?: {
                    type:
                        | 'NATID'
                        | 'MSISDN'
                        | 'EWALLETID'
                        | 'EMAIL'
                        | 'BILLERID';
                    account: string;
                };
            };
        };
        receiver: {
            bank: {
                id: string;
                name?: string;
                short?: string;
            };
            account: {
                name: {
                    th?: string;
                    en?: string;
                };
                bank?: {
                    type: 'BANKAC' | 'TOKEN' | 'DUMMY';
                    account: string;
                };
                proxy?: {
                    type:
                        | 'NATID'
                        | 'MSISDN'
                        | 'EWALLETID'
                        | 'EMAIL'
                        | 'BILLERID';
                    account: string;
                };
            };
            merchantId?: string;
        };
    };
}

@Injectable()
export class EasySlipService {
    private readonly easySlipClient: AxiosInstance;

    constructor() {
        const EASY_SLIP_BASE_URL = 'https://developer.easyslip.com/api/v1';

        this.easySlipClient = axios.create({
            baseURL: EASY_SLIP_BASE_URL,
            validateStatus: () => true,
        });

        this.easySlipClient.interceptors.request.use((config) => {
            config.headers.Authorization = `Bearer ${envConfig.easySlip.authToken}`;

            config.headers['Content-Type'] = 'application/json';

            return config;
        });
    }

    async verifyReceipt(
        receiptBase64: string,
        chargeAmount: number,
        targetBankAccountName: string,
    ) {
        try {
            const response =
                await this.easySlipClient.post<VerifyReceiptResponse>(
                    '/verify',
                    {
                        image: receiptBase64,
                    },
                );

            const data = response.data.data;

            if (!data)
                return {
                    data: null,
                    isError: true,
                    message: 'รูปภาพดังกล่าวไม่ใช่สลิปโอนเงินธนาคาร',
                };

            if (!data?.receiver)
                return {
                    data: null,
                    isError: true,
                    message: 'ไม่พบผู้รับเงิน',
                };

            const receiverName = data.receiver.account.name.th;

            if (!receiverName) {
                return {
                    data: null,
                    isError: true,
                    message: 'ไม่พบชื่อผู้รับเงิน',
                };
            }

            if (!targetBankAccountName.includes(receiverName)) {
                return {
                    data: null,
                    isError: true,
                    message: 'ผู้รับเงินไม่ถูกต้อง',
                };
            }

            const receivedAmount = data.amount.amount;

            if (!receivedAmount) {
                return {
                    data: null,
                    isError: true,
                    message: 'จำนวนเงินไม่ถูกต้อง',
                };
            }

            if (receivedAmount !== chargeAmount) {
                return {
                    data: null,
                    isError: true,
                    message: 'จำนวนเงินไม่ถูกต้อง',
                };
            }
            return {
                data: data,
                isError: response.data.status !== HttpStatus.OK,
                message:
                    response.data.status === HttpStatus.OK
                        ? 'ยืนยันการชำระเงินสำเร็จ'
                        : 'ยืนยันการชำระเงินไม่สำเร็จ',
            };
        } catch (error: any) {
            console.error(
                `EasySlipService.verifyReceipt() -> ${error.message}`,
            );
            return {
                data: null,
                isError: true,
                message: error.message,
            };
        }
    }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentStrategy } from './payment-strategy.interface';
import { PaymentMethod } from '../schemas/payment.schema';

@Injectable()
export class PaymentStrategyFactory {
    constructor(private readonly strategies: Array<PaymentStrategy>) {}

    getStrategy(method: PaymentMethod): PaymentStrategy {
        const strategy = this.strategies.find((s) => s.method === method);

        if (!strategy)
            throw new BadRequestException('Unsupported payment method');

        return strategy;
    }
}

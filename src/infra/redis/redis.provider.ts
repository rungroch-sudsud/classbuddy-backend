import { Provider } from '@nestjs/common';
import Redis from 'ioredis';


export const REDIS_CLIENT = 'REDIS_CLIENT';

export const RedisProvider: Provider = {
  provide: 'REDIS_CLIENT',
  useFactory: () => {
    return new Redis({
      host: process.env.REDIS_HOST || 'redis-server',
      port: Number(process.env.REDIS_PORT) || 6379,
    });
  },
};
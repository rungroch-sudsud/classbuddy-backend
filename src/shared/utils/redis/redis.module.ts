import { Global, Module } from '@nestjs/common';
import { RedisProvider, REDIS_CLIENT } from './redis.provider';

@Global() 
@Module({
  providers: [RedisProvider],
  exports: [RedisProvider],
})
export class RedisModule {}

export { REDIS_CLIENT };
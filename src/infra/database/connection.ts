import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { MongoConnection } from './mongo.logger';

@Module({
    imports: [
        MongooseModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (cfg: ConfigService) => ({
                uri: cfg.get<string>('MONGO_DB')!,
                autoIndex: process.env.NODE_ENV !== 'production',
                serverSelectionTimeoutMS: 5000,
                maxPoolSize: 10,
            }),
        }),
    ],
    providers: [MongoConnection],
    exports: [MongooseModule],
})

export class MongoDbModule { }

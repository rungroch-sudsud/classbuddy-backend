import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class MongoConnection implements OnModuleInit {
    private readonly logger = new Logger(MongoConnection.name);

    constructor(@InjectConnection() private readonly connection: Connection) { }

    onModuleInit() {

        if (this.connection.readyState === 1) {
            this.logger.log('✅ MongoDB already connected');
        }

        this.connection.on('connected', () => {
            this.logger.log('✅ MongoDB connected (event)');
        });

        this.connection.on('error', (err) => {
            this.logger.error(`❌ MongoDB connection error: ${err.message}`);
        });

        this.connection.on('disconnected', () => {
            this.logger.warn('⚠️ MongoDB disconnected');
        });
    }
}
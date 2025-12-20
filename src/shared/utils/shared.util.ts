import { isAxiosError } from 'axios';
import dayjs from 'dayjs';
import { MongoServerError } from 'mongodb';
import mongoose, { Types } from 'mongoose';
import { envConfig } from 'src/configs/env.config';

function isErrorObject(error: unknown): error is Error {
    return error instanceof Error;
}

function isMongoServerError(error: Error): error is MongoServerError {
    return error.name === 'MongoServerError';
}

export function getErrorMessage(
    error: unknown,
    defaultErrorMessage: string = 'เกิดข้อผิดพลาด',
): string {
    if (!isErrorObject(error)) return defaultErrorMessage;

    if (isAxiosError(error)) return error.response?.data;

    // ไม่ต้องแสดงข้อความ error ให้กับ user เผื่อ hacker เอาไปเป็น hint ในการ hack ได้เพราะมันเป็น error เกี่ยวกับ database
    if (isMongoServerError(error)) {
        console.error(`[ERROR] : ${error.message}`);
        return defaultErrorMessage;
    }

    return error.message;
}

export function secondsToMilliseconds(seconds: number) {
    const oneSecondInMilliseconds = 1000;

    return seconds * oneSecondInMilliseconds;
}

export function infoLog(
    entity: string,
    message: string,
    when: dayjs.Dayjs = dayjs(),
) {
    console.log(
        `[${entity}] -> ${message} (${when.format('DD/MM/YYYY HH:mm')})`,
    );
}

export function devLog(
    entity: string,
    message: string,
    when: dayjs.Dayjs = dayjs(),
) {
    if (envConfig.nodeEnv !== 'dev') return;

    console.log(
        `[DEV] [${entity}] -> ${message} (${when.format('DD/MM/YYYY HH:mm')})`,
    );
}

export function errorLog(
    entity: string,
    message: string,
    when: dayjs.Dayjs = dayjs(),
) {
    console.error(
        `[${entity}] -> ${message} (${when.format('DD/MM/YYYY HH:mm')})`,
    );
}

export function createObjectId(id: string): Types.ObjectId {
    return new mongoose.Types.ObjectId(id);
}

export function isDevEnv() {
    return envConfig.nodeEnv === 'dev';
}

export function isProductionEnv() {
    return envConfig.nodeEnv === 'production';
}

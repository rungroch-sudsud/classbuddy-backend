import { MongoServerError } from 'mongodb';

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

    if (isMongoServerError(error)) {
        console.error(`[ERROR] : ${error.message}`);
        return defaultErrorMessage;
    }

    return error.message;
}

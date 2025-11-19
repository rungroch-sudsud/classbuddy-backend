import { config } from 'dotenv';

config();

export const envConfig = {
    port: process.env.PORT,
    mongoDb: {
        MONGO_DB: process.env.MONGO_DB,
    },
    frontEndUrl: process.env.FRONT_END_URL,
    jwtSecret: process.env.JWT_SECRET,
    thaiBulk: {
        apiKey: process.env.THAIBULKSMS_API_KEY,
        secretKey: process.env.THAIBULKSMS_API_SECRET,
        emailSenderName: process.env.THAIBULK_EMAIL_SENDER_NAME,
    },
};

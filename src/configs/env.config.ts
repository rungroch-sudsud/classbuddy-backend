import { config } from 'dotenv';

config();

export const envConfig = {
    port: process.env.PORT,
    mongoDb: {
        MONGO_DB: process.env.MONGO_DB,
    },
    jwtSecret: process.env.JWT_SECRET,
};

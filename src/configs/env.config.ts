import { config } from 'dotenv';

config();

export const envConfig = {
  port: process.env.PORT,
  mongoDb: {
    MONGO_DB: process.env.MONGO_DB,
  },
};

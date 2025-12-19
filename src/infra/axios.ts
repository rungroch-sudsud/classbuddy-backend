import axios from 'axios';
import { envConfig } from 'src/configs/env.config';

const COUNTRIES_NOW_BASE_URL = 'https://countriesnow.space/api/v0.1';
const THAI_BULK_EMAIL_BASE_URL =
    'https://tbs-email-api-gateway.omb.to/email/v1';
const EXPO_NOTIFICATION_BASE_URL = 'https://exp.host/--/api/v2/push/send';

const countriesNowApiClient = axios.create({
    baseURL: COUNTRIES_NOW_BASE_URL,
});

const thaiBulkEmailClient = axios.create({
    baseURL: THAI_BULK_EMAIL_BASE_URL,
});

thaiBulkEmailClient.interceptors.request.use((config) => {
    const username = envConfig.thaiBulk.apiKey!;

    const password = envConfig.thaiBulk.secretKey!;

    config.auth = {
        username,
        password,
    };

    return config;
});

const expoNotificationClient = axios.create({
    baseURL: EXPO_NOTIFICATION_BASE_URL,
    validateStatus: () => true,
});

export { countriesNowApiClient, thaiBulkEmailClient, expoNotificationClient };

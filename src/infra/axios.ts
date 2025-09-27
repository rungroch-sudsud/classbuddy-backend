import axios from 'axios';

const COUNTRIES_NOW_BASE_URL = 'https://countriesnow.space/api/v0.1';

const countriesNowApiClient = axios.create({
  baseURL: COUNTRIES_NOW_BASE_URL,
});

export { countriesNowApiClient };

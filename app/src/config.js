/**
 * Application configuration
 */
export const DEFAULT_PROD_API_ORIGIN = 'https://ai.ssoggy.me';

export const PROD_API_ORIGIN =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PROD_API_ORIGIN) ||
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_ORIGIN) ||
    DEFAULT_PROD_API_ORIGIN;

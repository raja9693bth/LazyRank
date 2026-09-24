import { LEGAL_CONFIG } from '../../src/config/legal.ts';

export const SERVER_LEGAL_CONFIG = {
  ...LEGAL_CONFIG,
  APP_URL: process.env.APP_URL || LEGAL_CONFIG.APP_URL,
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || LEGAL_CONFIG.SUPPORT_EMAIL,
  SUPPORT_PHONE: process.env.SUPPORT_PHONE || LEGAL_CONFIG.SUPPORT_PHONE,
};

export { LEGAL_CONFIG };

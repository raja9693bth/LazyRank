import { LEGAL_CONFIG } from '../../src/config/legal.ts';

// Validate that environment overrides do not silently diverge from published identity
const appUrl = process.env.APP_URL || LEGAL_CONFIG.APP_URL;
const supportEmail = process.env.SUPPORT_EMAIL || LEGAL_CONFIG.SUPPORT_EMAIL;
const supportPhone = process.env.SUPPORT_PHONE || LEGAL_CONFIG.SUPPORT_PHONE;
const supportPhoneHref = process.env.SUPPORT_PHONE_HREF || LEGAL_CONFIG.SUPPORT_PHONE_HREF;

export const SERVER_LEGAL_CONFIG = {
  ...LEGAL_CONFIG,
  APP_URL: appUrl,
  SUPPORT_EMAIL: supportEmail,
  SUPPORT_PHONE: supportPhone,
  SUPPORT_PHONE_HREF: supportPhoneHref,
};

export { LEGAL_CONFIG };

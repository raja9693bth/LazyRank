/**
 * Centralized Legal & Business Identity Configuration
 * Single source of truth for Adabhra Group and LazyProof.
 *
 * DO NOT hardcode legal entity details or support channels elsewhere.
 */

export const LEGAL_CONFIG = {
  // Operating Legal Entity
  LEGAL_BUSINESS_NAME: 'Adabhra Group',
  ENTITY_TYPE: 'Sole Proprietorship',
  ORGANISATION_TYPE: 'Sole Proprietorship / Proprietary enterprise',
  REGISTRATION_COUNTRY: 'India',
  REGISTRATION_STATE: 'Bihar',
  PUBLIC_BUSINESS_ADDRESS: 'Bettiah, West Champaran, Bihar, India - 845454',
  BUSINESS_HOURS: 'Monday to Saturday, 10:00 AM – 6:00 PM IST',
  UDYAM_REGISTRATION_NUMBER: '', // Optional public display when configured

  // Brand & Product Identity
  BRAND_NAME: 'LazyProof',
  PRODUCT_NAME: 'LazyProof / LAZY',
  APP_URL: 'https://lazyproof.online',
  DOMAIN: 'lazyproof.online',

  // Customer Support Channels (Operational during business hours)
  SUPPORT_EMAIL: 'support@lazyproof.online',
  SUPPORT_PHONE: '+91 96938 41189',

  // Official Legal Statement
  OPERATING_STATEMENT:
    'LazyProof is a digital product operated by Adabhra Group, a sole proprietorship registered in India.',

  // Product Positioning & Core Mechanics
  POSITIONING_TITLE: 'Digital Sponsored Profile Showcase & Leaderboard',
  POSITIONING_CATEGORY: 'Digital Profile Placement',
  SERVICE_DESCRIPTION: 'Digital Sponsored Profile Placement & Public Leaderboard Showcase',
  RANKING_DYNAMIC: 'Leaderboard position is determined deterministically by cumulative verified sponsorship amount. Another participant may sponsor a higher amount and displace your rank.',
  MECHANIC_DESCRIPTION:
    'Leaderboard position is determined deterministically by cumulative verified sponsorship amount. Higher cumulative verified payment results in higher leaderboard placement.',

  // Explicit Non-Gambling & Consumer Disclaimers
  DISCLAIMER:
    'LazyProof is a digital sponsored showcase. It is NOT gambling, lottery, sweepstakes, betting, or a game of chance. It offers no prize money, no winnings, no cash payouts, no financial returns, and no redeemable investments. Paid amounts are non-refundable consideration for digital placement services once delivered.',
  NON_GAMBLING_DISCLAIMER:
    'LazyProof is a digital sponsored showcase. It is NOT gambling, lottery, sweepstakes, betting, or a game of chance. It offers no prize money, no winnings, no cash payouts, no financial returns, and no redeemable investments. Paid amounts are non-refundable consideration for digital placement services once delivered.',

  // Service Delivery Target
  DELIVERY_TIMELINE:
    'Digital placement is delivered automatically upon server verification of payment confirmation, typically within 5 to 30 seconds of gateway settlement.',

  // Refund Processing Timeline
  REFUND_PROCESSING_TIMELINE:
    'Eligible refund requests (e.g. verified duplicate charges or technical failures where placement was not delivered) are processed within 5 to 7 business days back to the original payment method.',

  // Tax Disclosure
  TAX_DISCLOSURE:
    'Prices are displayed in Indian Rupees (INR) and are inclusive of applicable taxes, if any. Tax invoices are not issued under threshold exemption unless GST registration is activated.'
} as const;

export type LegalConfig = typeof LEGAL_CONFIG;

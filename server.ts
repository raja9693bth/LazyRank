import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import sharp from 'sharp';
import { db } from './server/db.ts';
import { generateRoast, generateFallbackRoast } from './server/roast.ts';
import { generateProfileOgSvg, injectProfileMetadata, injectRouteMetadata, ROUTE_SEO } from './server/seo.ts';
import { stripTrailingSlash } from './src/utils/seo.ts';
import { computeCheckoutFingerprint } from './src/utils/checkoutContract.ts';
import {
  SERVER_LEGAL_CONFIG,
  CURRENT_CONSENT_VERSION,
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION
} from './server/config/legal.ts';

import { paymentManager } from './server/payments/index.ts';
import { prerenderRoute } from './server/prerender.tsx';
import { validateContact, ContactInput, hashToken, verifyOwnerToken, constantTimeMatch } from './server/db/postgres.ts';
import { toSafePaise } from './server/payments/provider.ts';
import {
  MIN_INR_PAISE,
  MIN_USD_CENTS,
  INR_STEP_PAISE,
  CURRENT_PRICING_VERSION,
  calculateRankTarget,
  validatePaymentAmount,
  calculateRankCreditFromUSD,
  getPricingCapabilities
} from './server/payments/pricingPolicy.ts';

function sanitizeLog(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  return str.replace(/[\r\n\t]/g, '_').slice(0, 500);
}

function verifyOrderReadAccess(order: any, req: Request): { allowed: boolean; error?: string; status?: number } {
  const orderAccessToken = (req.headers['x-order-access-token'] as string | undefined)?.trim();
  const profileToken = (req.headers['x-profile-token'] as string | undefined)?.trim();
  const tokenHash = order.orderAccessTokenHash || (order.orderAccessToken ? hashToken(order.orderAccessToken) : undefined);
  if (tokenHash) {
    if (!orderAccessToken || !constantTimeMatch(tokenHash, hashToken(orderAccessToken))) {
      return { allowed: false, error: 'Unauthorized: Valid order access token required.', status: 403 };
    }
  } else {
    // Historical orders with NULL order_access_token_hash: require verifiable owner authentication
    const ownerHash = order.ownerTokenHash || order.ownerToken;
    if (ownerHash) {
      if (!profileToken || !verifyOwnerToken(ownerHash, profileToken)) {
        return { allowed: false, error: 'Unauthorized: Valid profile token required for historical order.', status: 403 };
      }
    } else {
      // Historical orders missing BOTH order_access_token_hash and owner_token_hash:
      // Deny anonymous status and receipt access. Allow administrative support procedure via x-admin-key.
      const adminKey = (req.headers['x-admin-key'] as string | undefined)?.trim();
      if (!adminKey || !verifyAdminKey(adminKey)) {
        return { allowed: false, error: 'Unauthorized: Historical order requires administrative support verification.', status: 403 };
      }
    }
  }
  return { allowed: true };
}

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const BANNED_WORDS = [
  'kill', 'suicide', 'die', 'murder', 'bitch', 'asshole', 'bastard', 'slut', 'whore', 'nigger', 'faggot', 'chutiya', 'madarchod', 'bhenchod', 'gaand'
];

function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_WORDS.some(word => lower.includes(word));
}

// In-memory rate limiter with stale key garbage collection to prevent memory leaks
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(ip: string, maxRequests: number = 40, windowMs: number = 60000): boolean {
  const now = Date.now();
  let timestamps = rateLimitMap.get(ip) || [];
  timestamps = timestamps.filter(t => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    rateLimitMap.set(ip, timestamps);
    return false;
  }
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return true;
}

// Stale entry cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const active = timestamps.filter(t => now - t < 60000);
    if (active.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, active);
    }
  }
}, 5 * 60 * 1000);

function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export { CURRENT_CONSENT_VERSION, CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION };


const ADMIN_SECRET = process.env.ADMIN_KEY || process.env.ADMIN_SECRET;

function verifyAdminKey(providedKey?: string): boolean {
  if (!ADMIN_SECRET || typeof ADMIN_SECRET !== 'string' || ADMIN_SECRET.trim().length === 0) {
    return false;
  }
  if (!providedKey || typeof providedKey !== 'string') return false;
  try {
    const keyBuf = Buffer.from(providedKey.trim());
    const secretBuf = Buffer.from(ADMIN_SECRET.trim());
    if (keyBuf.length !== secretBuf.length) return false;
    return crypto.timingSafeEqual(keyBuf, secretBuf);
  } catch {
    return false;
  }
}

const PAYMENT_MODE = (process.env.PAYMENT_MODE || 'disabled').toLowerCase().trim();

export function isSafeLocalTestDatabase(url?: string): boolean {
  if (!url || typeof url !== 'string' || !url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
      return false;
    }
    const rawHostname = parsed.hostname.toLowerCase().trim();
    const cleanHostname = rawHostname.replace(/^\[|\]$/g, '');
    const isLoopback = cleanHostname === 'localhost' || cleanHostname === '127.0.0.1' || cleanHostname === '::1';
    if (!isLoopback) {
      return false;
    }
    // Remote hosts or Neon must be strictly rejected
    if (
      rawHostname.includes('neon.tech') ||
      rawHostname.includes('neon.build') ||
      rawHostname.includes('aws.neon')
    ) {
      return false;
    }
    // Database name check: must match an explicitly allowed disposable test DB policy
    // e.g. exact lazyproof_test, *_test, or explicit TEST_DATABASE_NAME
    const dbName = parsed.pathname.replace(/^\/+/, '').trim().toLowerCase();
    const isExplicitTestDb =
      dbName === 'lazyproof_test' ||
      dbName.endsWith('_test') ||
      Boolean(process.env.TEST_DATABASE_NAME && dbName === process.env.TEST_DATABASE_NAME.toLowerCase().trim());
    if (!isExplicitTestDb) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function sanitizeCanonicalPathAndQuery(inputUrl: string): string {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return '/';
  }

  // Reject CR, LF, null byte, and all ASCII control characters
  if (/[\r\n\0\t\x00-\x1F\x7F]/.test(inputUrl)) {
    return '/';
  }

  // Reject backslashes (which browsers may normalize to slashes leading to open redirect)
  if (inputUrl.includes('\\')) {
    return '/';
  }

  // Must begin with a single forward slash and cannot be protocol-relative '//'
  if (!inputUrl.startsWith('/') || inputUrl.startsWith('//')) {
    return '/';
  }

  try {
    // Parse against an inert trusted dummy base
    const inertBase = 'http://127.0.0.1';
    const parsed = new URL(inputUrl, inertBase);

    // Host and origin must remain strictly identical to inert base
    if (parsed.origin !== inertBase || parsed.hostname !== '127.0.0.1') {
      return '/';
    }

    // Pathname must begin with single slash and not contain backslashes or leading double slash
    if (!parsed.pathname.startsWith('/') || parsed.pathname.startsWith('//') || parsed.pathname.includes('\\')) {
      return '/';
    }

    const safePathAndQuery = `${parsed.pathname}${parsed.search}`;

    // Verify constructed URL on canonical origin
    const canonicalTarget = new URL(safePathAndQuery, 'https://lazyproof.online');
    if (canonicalTarget.origin !== 'https://lazyproof.online' || canonicalTarget.hostname !== 'lazyproof.online') {
      return '/';
    }

    return safePathAndQuery;
  } catch {
    return '/';
  }
}

export function getCanonicalRedirectUrl(
  host: string,
  proto: string,
  originalUrl: string,
  isProd: boolean = true
): string | null {
  if (!isProd) return null;
  const cleanHost = host.split(':')[0].toLowerCase().trim();
  const cleanProto = proto.toLowerCase().trim();
  const isWww = cleanHost === 'www.lazyproof.online';
  const isApex = cleanHost === 'lazyproof.online';
  const isHttp = cleanProto === 'http';

  if (isWww || (isApex && isHttp)) {
    const safePathAndQuery = sanitizeCanonicalPathAndQuery(originalUrl);
    const targetUrl = new URL(safePathAndQuery, 'https://lazyproof.online');
    if (targetUrl.origin === 'https://lazyproof.online' && targetUrl.hostname === 'lazyproof.online') {
      return targetUrl.href;
    }
    return 'https://lazyproof.online/';
  }
  return null;
}

export function validateRefundEnvironmentSecurity(): void {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_REFUNDS === 'true') {
    throw new Error('FATAL CONFIGURATION ERROR: ALLOW_MOCK_REFUNDS cannot be enabled in production environment.');
  }
}

async function startServer() {
  validateRefundEnvironmentSecurity();
  const isProd = process.env.NODE_ENV === 'production';
  const usePg = isProd || process.env.USE_POSTGRES === 'true';

  // Section 2A: Mandatory DATABASE_URL in production with fail-fast startup
  if (usePg) {
    if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
      throw new Error('FATAL CONFIGURATION ERROR: DATABASE_URL is mandatory in production environment. Silently falling back to local JSON is prohibited.');
    }
    const pgInitOk = await db.pg.init();
    if (!pgInitOk) {
      console.warn(
        '[PostgreSQL] WARNING: Initial database connection could not be established during startup. Starting HTTP listener in fail-closed state while self-healing readiness probes retry.'
      );
    } else {
      console.log('[PostgreSQL] Initialized as authoritative production database.');
    }
  }

  const app = express();
  const PORT = Number.parseInt(process.env.PORT || '3000', 10);

  // Disable server technology fingerprinting
  app.disable('x-powered-by');

  // Explicit trust proxy configuration to prevent X-Forwarded-For IP spoofing
  if (process.env.TRUST_PROXY) {
    const tp = process.env.TRUST_PROXY.trim();
    if (tp === 'true') {
      app.set('trust proxy', true);
    } else if (tp === 'false') {
      app.set('trust proxy', false);
    } else if (!Number.isNaN(Number(tp))) {
      app.set('trust proxy', Number(tp));
    } else {
      app.set('trust proxy', tp);
    }
  } else if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_STATIC_URL) {
    // Railway routes traffic through 1 reverse proxy hop
    app.set('trust proxy', 1);
  } else {
    // In production without an explicit TRUST_PROXY setting, default to false
    app.set('trust proxy', false);
  }

  // Security Headers Middleware
  app.use((req: Request, res: Response, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    const isProd = process.env.NODE_ENV === 'production';
    const cspDirectives = [
      "default-src 'self'",
      isProd
        ? "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://www.googletagmanager.com"
        : "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://www.googletagmanager.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob: https://*.google-analytics.com https://*.googletagmanager.com",
      isProd
        ? "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://checkout.dodopayments.com https://test.dodopayments.com https://api.dodopayments.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com"
        : "connect-src 'self' ws: wss: https: https://api.razorpay.com https://lumberjack.razorpay.com https://checkout.dodopayments.com https://test.dodopayments.com https://api.dodopayments.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
      "frame-src 'self' https://api.razorpay.com https://checkout.dodopayments.com https://test.dodopayments.com",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'"
    ].join('; ');
    res.setHeader('Content-Security-Policy', cspDirectives);
    if (req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // Canonical Host & Protocol Consolidation Middleware (Production)
  // Consolidates HTTP apex, HTTP www, and HTTPS www permanently (301) to canonical https://lazyproof.online
  app.use((req: Request, res: Response, next: NextFunction) => {
    const rawHost = req.headers['x-forwarded-host'] || req.headers.host || '';
    const host = Array.isArray(rawHost) ? rawHost[0] : rawHost;
    const rawProto = req.headers['x-forwarded-proto'];
    const proto = Array.isArray(rawProto) ? rawProto[0] : rawProto || (req.secure ? 'https' : 'http');

    const redirectUrl = getCanonicalRedirectUrl(host, proto, req.originalUrl, process.env.NODE_ENV === 'production');
    if (redirectUrl) {
      try {
        const dest = new URL(redirectUrl);
        if (dest.origin === 'https://lazyproof.online' && dest.hostname === 'lazyproof.online') {
          return res.redirect(301, dest.href);
        }
      } catch {
        // Fallback to canonical home
      }
      return res.redirect(301, 'https://lazyproof.online/');
    }
    next();
  });

  app.use(express.json({
    limit: '100kb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  }));

  // API ROUTES

  const buildSha = (
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.COMMIT_SHA ||
    'unknown'
  ).slice(0, 40);

  // Health check with safe public build SHA
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      product: 'LAZY',
      version: '2.0',
      storage: db.isPostgresAuthoritative() ? 'postgresql' : 'json',
      commitSha: buildSha
    });
  });

  // DB readiness check: performs real connectivity check and schema verification, returns 503 on failure
  app.get('/api/ready', asyncHandler(async (_req: Request, res: Response) => {
    if (db.isPostgresAuthoritative()) {
      const readiness = await db.pg.checkReadiness();
      if (!readiness.ready) {
        return res.status(503).json({
          status: 'error',
          ready: false,
          storage: 'postgresql',
          commitSha: buildSha,
          error: readiness.error || 'Database unavailable',
          timestamp: new Date().toISOString()
        });
      }
      return res.status(200).json({
        status: 'ok',
        ready: true,
        storage: 'postgresql',
        commitSha: buildSha,
        latencyMs: readiness.latencyMs,
        timestamp: new Date().toISOString()
      });
    }
    return res.status(200).json({
      status: 'ok',
      ready: true,
      storage: 'json',
      commitSha: buildSha,
      timestamp: new Date().toISOString()
    });
  }));

  // Leaderboard endpoint (Canonical source of paid ranks with server pagination & period filtering)
  app.get('/api/leaderboard', asyncHandler(async (req: Request, res: Response) => {
    const rawPeriod = (req.query.period as string) || 'all';
    if (rawPeriod !== 'all' && rawPeriod !== 'today') {
      return res.status(400).json({
        error: "Unsupported period parameter. Supported periods are 'all' and 'today'."
      });
    }
    const period = rawPeriod as 'all' | 'today';
    const page = req.query.page ? Number.parseInt(req.query.page as string, 10) : undefined;
    const pageSize = req.query.pageSize ? Number.parseInt(req.query.pageSize as string, 10) : undefined;
    const offset = req.query.offset !== undefined ? Number.parseInt(req.query.offset as string, 10) : undefined;
    const limit = req.query.limit !== undefined ? Number.parseInt(req.query.limit as string, 10) : undefined;
    const filter = (req.query.filter as 'verified' | 'all') || 'verified';

    if (db.isPostgresAuthoritative()) {
      try {
        const data = await db.pg.getLeaderboard({ period, page, pageSize, offset, limit, filter });
        return res.json({
          ...data,
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        console.error('[Leaderboard] Database query failed:', err?.message || err);
        return res.status(503).json({
          error: 'Database temporarily unavailable. Please retry shortly.',
          timestamp: new Date().toISOString()
        });
      }
    }

    const data = db.getLeaderboard({ period, page, pageSize, offset, limit, filter });
    res.json({
      ...data,
      timestamp: new Date().toISOString()
    });
  }));

  // Create unverified participant claim (Section 5) - RETIRED WITH HTTP 410
  app.post('/api/participant/create', (_req: Request, res: Response) => {
    return res.status(410).json({
      error: 'Endpoint retired. Unverified participant creation has been discontinued in favour of authoritative checkout.'
    });
  });

  // Get current #1 and minimum required amount to beat #1
  app.get('/api/rank/top', asyncHandler(async (req: Request, res: Response) => {
    let topAmount = 0;
    try {
      if (db.isPostgresAuthoritative()) {
        topAmount = await db.pg.getTopAmount();
      } else {
        topAmount = db.getTopAmount();
      }
    } catch (err: any) {
      console.error('[Top Rank API] Database query error:', err);
      return res.status(503).json({ error: 'Database service temporarily unavailable.' });
    }
    const target = calculateRankTarget(topAmount, 0, 'INR');
    res.json({
      topAmount,
      minAmountToBeatTop: target.suggestedChargeINR
    });
  }));

  // Genuine live status and session heartbeat (API contract: supports x-session-id header and sessionId query)
  app.get('/api/stats/live', (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 60, 60000)) {
      return res.status(429).json({ error: 'Too many stats requests. Please slow down.' });
    }

    const headerSession = req.headers['x-session-id'];
    const querySession = req.query.sessionId;
    const rawSession = (typeof headerSession === 'string' ? headerSession : undefined) ||
                       (typeof querySession === 'string' ? querySession : undefined);

    let sessionId: string | undefined;
    if (rawSession && rawSession.trim().length > 0) {
      sessionId = rawSession.trim().slice(0, 64);
    }

    const stats = db.getLiveStats(sessionId);
    res.json({
      ...stats,
      timestamp: new Date().toISOString()
    });
  });

  app.post('/api/stats/heartbeat', (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 60, 60000)) {
      return res.status(429).json({ error: 'Too many heartbeat requests.' });
    }

    const { sessionId } = req.body;
    if (sessionId && typeof sessionId === 'string' && sessionId.trim().length > 0) {
      const sanitizedSessionId = sessionId.trim().slice(0, 64);
      const result = db.recordHeartbeat(sanitizedSessionId);
      return res.json({ ok: true, ...result });
    }
    res.json({ ok: true });
  });

  const isTaxReady = (): boolean =>
    process.env.MERCHANT_TAX_BASIS === 'verified_unregistered_below_threshold' &&
    process.env.MERCHANT_TAX_REVIEWED === 'true';
  const getTaxDisclosure = (): string => isTaxReady()
    ? 'Unregistered (Turnover below threshold under Section 22 CGST Act) — ₹0'
    : 'GST status being verified — checkout unavailable';

  // Payment Gateway Configuration / Status
  app.get('/api/payment/config', (_req: Request, res: Response) => {
    const taxReady = isTaxReady();
    const taxDisclosure = getTaxDisclosure();
    const publicConfig = paymentManager.getPublicConfig();
    const providerName = paymentManager.getProvider().name;
    const isCheckoutReady = paymentManager.mayCreateNewOrder(providerName, 'INR') && taxReady;
    const usdEnabled = publicConfig.capabilities.USD.enabled;

    res.json({
      paymentMode: paymentManager.getMode(),
      enabled: isCheckoutReady,
      checkoutEnabled: isCheckoutReady,
      taxReady,
      taxDisclosure,
      provider: providerName,
      enabledProviders: paymentManager.enabledProviders,
      isSandbox: paymentManager.getMode() === 'sandbox',
      legalBusinessName: SERVER_LEGAL_CONFIG.LEGAL_BUSINESS_NAME,
      brandName: SERVER_LEGAL_CONFIG.BRAND_NAME,
      serviceDescription: SERVER_LEGAL_CONFIG.SERVICE_DESCRIPTION,
      currency: 'INR',
      supportedCurrencies: ['INR', ...(usdEnabled ? ['USD'] : [])],
      pricingCapabilities: publicConfig.capabilities,
      pricingVersion: CURRENT_PRICING_VERSION,
      requiresQuote: true,
      razorpayKeyId: publicConfig.razorpayKeyId,
      onboardingNotice: isCheckoutReady
        ? null
        : 'Payments will be verified server-side when gateway processing is enabled.'
    });
  });

  interface StoredQuote {
    quoteId: string;
    currency: 'INR' | 'USD';
    amountMinor: number;
    chargeAmountMinor?: number;
    rankCreditPaise: number;
    pricingVersion?: string;
    provider?: string;
    environment?: string;
    accountId?: string;
    taxMode?: string;
    purpose?: string;
    profileId?: string | null;
    authHash?: string;
    createdAt: string;
    expiresAt: string;
    conversionDetails?: any;
    consumedAt?: string;
  }

  const serverQuotes = new Map<string, StoredQuote>();

  // In-memory quote cleanup
  setInterval(() => {
    const now = Date.now();
    for (const [id, q] of serverQuotes.entries()) {
      if (new Date(q.expiresAt).getTime() < now) {
        serverQuotes.delete(id);
      }
    }
  }, 5 * 60 * 1000).unref();

  // Authoritative server quote endpoint (5-minute TTL, versioned conversions)
  app.post('/api/payment/quote', asyncHandler(async (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 40, 60000)) {
      return res.status(429).json({ error: 'Too many quote requests. Please slow down.' });
    }

    const { amount, currency = 'INR', profileId } = req.body;
    if (currency !== undefined && currency !== 'INR' && currency !== 'USD') {
      return res.status(400).json({
        error: 'Unsupported currency. Only INR and USD are supported.',
        code: 'CURRENCY_NOT_SUPPORTED',
        currency
      });
    }
    const selectedCurrency = (typeof currency === 'string' && currency.toUpperCase() === 'USD') ? 'USD' : 'INR';

    if (selectedCurrency === 'USD' && !paymentManager.isUsdEnabled()) {
      return res.status(400).json({
        error: 'USD checkout is currently disabled pending live international merchant approval and live FX quote verification.',
        code: 'CURRENCY_NOT_AVAILABLE',
        currency: 'USD'
      });
    }

    const validation = validatePaymentAmount(amount, selectedCurrency);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error,
        code: validation.code,
        currency: selectedCurrency,
        field: 'amount',
        minMinor: selectedCurrency === 'INR' ? MIN_INR_PAISE : MIN_USD_CENTS
      });
    }

    let rankCreditPaise = validation.amountMinor;
    let conversionDetails: any = undefined;

    if (selectedCurrency === 'USD') {
      const ratePaisePerCent = Number.parseInt(process.env.FX_USD_INR_RATE_PAISE_PER_CENT || '90', 10);
      const fxQuote = calculateRankCreditFromUSD(validation.amountMinor, ratePaisePerCent);
      rankCreditPaise = fxQuote.rankCreditPaise;
      conversionDetails = {
        numerator: fxQuote.numerator,
        denominator: fxQuote.denominator,
        rateDirection: 'INR_PAISE_PER_USD_CENT',
        quotedRatePaisePerCent: ratePaisePerCent,
        canonicalRankCreditPaise: rankCreditPaise,
        source: 'server_authoritative_pricing_policy'
      };
    }

    const providerObj = paymentManager.getProviderForIntent(selectedCurrency);
    const quoteId = `qte_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    const now = Date.now();
    const expiresAt = new Date(now + 5 * 60 * 1000).toISOString();
    const purpose = profileId ? 'upgrade' : 'new';

    // Compute secure authorization intent hash without persisting raw tokens
    const authHash = crypto.createHash('sha256').update(
      `${quoteId}:${validation.amountMinor}:${selectedCurrency}:${purpose}:${profileId || 'new'}:${clientIp}`
    ).digest('hex');

    const snapshot: StoredQuote = {
      quoteId,
      currency: selectedCurrency as 'INR' | 'USD',
      amountMinor: validation.amountMinor,
      chargeAmountMinor: validation.amountMinor,
      rankCreditPaise,
      pricingVersion: CURRENT_PRICING_VERSION,
      provider: providerObj.name,
      environment: paymentManager.getMode(),
      accountId: 'primary',
      taxMode: 'tax_inclusive',
      purpose,
      profileId: profileId || null,
      authHash,
      createdAt: new Date(now).toISOString(),
      expiresAt,
      conversionDetails
    };

    if (db.createPaymentQuoteAsync) {
      await db.createPaymentQuoteAsync({
        quoteId,
        provider: providerObj.name,
        environment: paymentManager.getMode(),
        accountId: 'primary',
        currency: selectedCurrency,
        amountMinor: validation.amountMinor,
        rankCreditPaise,
        taxMode: 'tax_inclusive',
        pricingVersion: CURRENT_PRICING_VERSION,
        purpose,
        profileId: profileId || null,
        claimantName: null,
        authHash,
        expiresAt,
        quoteSnapshot: snapshot
      });
    }

    serverQuotes.set(quoteId, snapshot);

    return res.json({
      quoteId,
      currency: selectedCurrency,
      amountMinor: validation.amountMinor,
      chargeAmountMinor: validation.amountMinor,
      chargeAmountDisplay: selectedCurrency === 'INR' ? `₹${validation.amountMinor / 100}` : `$${(validation.amountMinor / 100).toFixed(2)}`,
      rankCreditPaise,
      rankCreditDisplayINR: `₹${Math.floor(rankCreditPaise / 100)}`,
      pricingVersion: CURRENT_PRICING_VERSION,
      taxMode: 'tax_inclusive',
      taxBasis: 'Pricing is tax-inclusive. Dodo Payments serves as Merchant of Record.',
      taxPaise: 0,
      feePaise: 0,
      totalMinor: validation.amountMinor,
      expiresAt,
      purpose,
      profileId: profileId || null,
      authHash,
      conversionDetails
    });
  }));

  // Create payment order / initiate claim
  app.post('/api/payment/create-order', asyncHandler(async (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 30, 60000)) {
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }

    const {
      name, amount, currency: reqCurrency, instagram, linkedin, website, twitter, reason, lazyReason,
      profileId, customerEmail, customerPhone, consentAccepted,
      consentVersion: reqConsentVersion, quoteId: reqQuoteId,
      ownerToken: bodyOwnerToken, pendingOwnerToken, orderAccessToken
    } = req.body;

    if (reqCurrency !== undefined && reqCurrency !== 'INR' && reqCurrency !== 'USD') {
      return res.status(400).json({
        error: 'Unsupported currency. Only INR and USD are supported.',
        code: 'CURRENCY_NOT_SUPPORTED',
        currency: reqCurrency
      });
    }

    const requestedCurrency = (typeof reqCurrency === 'string' && reqCurrency.toUpperCase() === 'USD') ? 'USD' : 'INR';
    const intentProvider = paymentManager.getProviderForIntent(requestedCurrency);

    // STRICT PAYMENT GATING: capability check on target provider and currency
    if (!paymentManager.mayCreateNewOrder(intentProvider.name, requestedCurrency)) {
      return res.status(503).json({
        error: 'Payments are currently unavailable until payment processing is enabled.',
        paymentMode: paymentManager.getMode()
      });
    }

    if (!isTaxReady()) {
      return res.status(503).json({
        error: 'Checkout unavailable pending payment and tax verification.',
        paymentMode: paymentManager.getMode()
      });
    }

    const providedToken = (req.headers['x-profile-token'] as string) || bodyOwnerToken || pendingOwnerToken;
    const clientOrderAccessToken = (req.headers['x-order-access-token'] as string) || orderAccessToken;

    if (requestedCurrency === 'USD' && !paymentManager.isUsdEnabled()) {
      return res.status(400).json({
        error: 'USD checkout is currently disabled pending live international merchant approval and live FX quote verification.',
        code: 'CURRENCY_NOT_AVAILABLE',
        currency: 'USD'
      });
    }

    const validation = validatePaymentAmount(amount, requestedCurrency);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error,
        code: validation.code,
        currency: requestedCurrency,
        field: 'amount',
        minMinor: requestedCurrency === 'INR' ? MIN_INR_PAISE : MIN_USD_CENTS
      });
    }

    const chargeCurrency = validation.currency;
    const chargeAmountMinor = validation.amountMinor;
    let canonicalRankCreditPaise = chargeAmountMinor; // For INR, paise = paise
    const fxQuoteId = reqQuoteId ? String(reqQuoteId).trim() : undefined;

    // Validate quote if provided
    if (reqQuoteId) {
      const storedQuote = db.getPaymentQuoteAsync
        ? await db.getPaymentQuoteAsync(String(reqQuoteId).trim())
        : serverQuotes.get(String(reqQuoteId).trim());

      if (!storedQuote) {
        return res.status(400).json({
          error: 'Quote not found or invalid.',
          code: 'INVALID_QUOTE'
        });
      }
      if (new Date(storedQuote.expiresAt).getTime() < Date.now()) {
        return res.status(400).json({
          error: 'Quote has expired. Please obtain a fresh quote.',
          code: 'QUOTE_EXPIRED'
        });
      }
      if ((storedQuote as any).consumedAt) {
        return res.status(409).json({
          error: 'Quote has already been used.',
          code: 'QUOTE_ALREADY_CONSUMED'
        });
      }
      if (storedQuote.currency !== chargeCurrency ||
          Number(storedQuote.chargeAmountMinor || (storedQuote as any).amountMinor) !== chargeAmountMinor) {
        return res.status(400).json({
          error: 'Order parameters do not match quoted amount or currency.',
          code: 'QUOTE_MISMATCH'
        });
      }
    }

    if (chargeCurrency === 'USD') {
      const ratePaisePerCent = Number.parseInt(process.env.FX_USD_INR_RATE_PAISE_PER_CENT || '90', 10);
      const fxQuote = calculateRankCreditFromUSD(chargeAmountMinor, ratePaisePerCent);
      canonicalRankCreditPaise = fxQuote.rankCreditPaise;
    }

    // Canonical whole rupees for leaderboard/profile display
    const parsedAmount = Math.floor(canonicalRankCreditPaise / 100);

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Display name is required.' });
    }

    if (name.trim().length > 30) {
      return res.status(400).json({ error: 'Display name cannot exceed 30 characters.' });
    }

    // For existing profile upgrades: profile must exist, owner token must be present and valid
    if (profileId) {
      const existing = db.isPostgresAuthoritative() ? await db.pg.getRawProfile(profileId) : db.getRawProfile(profileId);
      if (!existing) {
        return res.status(404).json({ error: 'Profile not found.' });
      }
      const existingHash = (existing as any).ownerTokenHash || existing.ownerToken;
      if (!providedToken || !verifyOwnerToken(existingHash, providedToken)) {
        return res.status(403).json({ error: 'Unauthorized: Valid owner token is required to upgrade this profile.' });
      }
    } else {
      if (!pendingOwnerToken || typeof pendingOwnerToken !== 'string' || !/^lazy_[0-9a-f]{64}$/i.test(pendingOwnerToken)) {
        return res.status(400).json({ error: 'A valid pending owner token is required.' });
      }
    }

    if (!clientOrderAccessToken || typeof clientOrderAccessToken !== 'string' || !/^ord_[0-9a-f]{64}$/i.test(clientOrderAccessToken)) {
      return res.status(400).json({ error: 'A valid order access token is required.' });
    }

    // Affirmative consent validation: must be explicitly true
    if (consentAccepted !== true) {
      return res.status(400).json({ error: 'You must affirmatively accept the Terms & Conditions and Privacy Policy to proceed.' });
    }

    // Authoritative checkout consent version enforcement: reject obsolete or mismatched versions
    const consentVersion = typeof reqConsentVersion === 'string' ? reqConsentVersion.trim() : '';
    if (consentVersion !== CURRENT_CONSENT_VERSION) {
      return res.status(409).json({
        error: 'Terms or policies have been updated. Please refresh the page, review the current policies, and consent again.',
        currentConsentVersion: CURRENT_CONSENT_VERSION
      });
    }

    // Customer phone validation: Indian mobile for INR; international E.164 for USD
    const phoneStr = (customerPhone && typeof customerPhone === 'string' ? customerPhone.trim() : '');
    if (chargeCurrency === 'INR') {
      const cleanPhone = phoneStr.replace(/^\+91/, '').replace(/\s+/g, '');
      if (!cleanPhone || !/^[6-9]\d{9}$/.test(cleanPhone)) {
        return res.status(400).json({ error: 'A valid 10-digit mobile number is required for checkout.' });
      }
    } else {
      const cleanIntlPhone = phoneStr.replace(/[\s\-()]/g, '');
      if (!cleanIntlPhone || !/^\+?[1-9]\d{6,14}$/.test(cleanIntlPhone)) {
        return res.status(400).json({ error: 'A valid phone number (including country code) is required for checkout.' });
      }
    }

    // Optional customer email validation: if provided, must be valid format; if omitted, leave undefined
    let validCustomerEmail: string | undefined = undefined;
    if (customerEmail && typeof customerEmail === 'string' && customerEmail.trim().length > 0) {
      const emailTrim = customerEmail.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
        return res.status(400).json({ error: 'Please enter a valid email address or leave the field blank.' });
      }
      validCustomerEmail = emailTrim;
    }

    if (reason && typeof reason === 'string' && reason.length > 140) {
      return res.status(400).json({ error: 'Reason cannot exceed 140 characters.' });
    }

    if (containsProfanity(name) || (reason && containsProfanity(reason))) {
      return res.status(400).json({ error: 'Please keep name and reason respectful.' });
    }

    const topAmount = db.isPostgresAuthoritative() ? await db.pg.getTopAmount() : db.getTopAmount();
    const target = calculateRankTarget(topAmount, 0, 'INR');
    const isTop = parsedAmount > topAmount;
    const minAmountToBeatTop = target.suggestedChargeINR;

    // Server-authoritative quote breakdown in minor integer units
    let basePaise = parsedAmount * 100;
    if (chargeCurrency !== 'INR') {
      basePaise = canonicalRankCreditPaise;
    }
    const taxPaise = 0;
    const feePaise = 0;
    const totalPaise = basePaise + taxPaise + feePaise;
    const quoteSnapshot = {
      quoteId: fxQuoteId,
      basePaise,
      taxPaise,
      feePaise,
      totalPaise,
      currency: chargeCurrency,
      chargeAmountMinor,
      canonicalRankCreditPaise,
      serviceDescription: 'Digital sponsored profile placement on LazyProof',
      taxBasis: isTaxReady()
        ? 'GST not charged: supplier verified unregistered under applicable registration rules'
        : 'GST status being verified — checkout unavailable',
      quoteVersion: CURRENT_CONSENT_VERSION,
      pricingVersion: CURRENT_PRICING_VERSION,
      fxQuoteId,
      timestamp: new Date().toISOString()
    };

    db.trackEvent('checkoutStarts');

    // Real retry-safe checkout idempotency
    const clientProvidedIdempotency = (req.headers['x-idempotency-key'] as string | undefined)?.trim() ||
      (req.body?.idempotencyKey as string | undefined)?.trim();
    const idempotencyKey = clientProvidedIdempotency || `idem_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    // Intent provider resolved and gated above

    // If order with this idempotencyKey already exists, verify consistency and return directly
    const existingOrder = await db.getOrderByIdempotencyKey(idempotencyKey);
    if (existingOrder) {
      const existingFingerprint = computeCheckoutFingerprint({
        name: existingOrder.name,
        amount: existingOrder.amount,
        customerPhone: existingOrder.customerPhone,
        customerEmail: existingOrder.customerEmail,
        profileId: existingOrder.profileId,
        instagram: existingOrder.instagram,
        linkedin: existingOrder.linkedin,
        website: existingOrder.website,
        twitter: existingOrder.twitter,
        reason: existingOrder.reason,
        lazyReason: existingOrder.lazyReason,
        consentAccepted: existingOrder.consentAccepted,
        consentVersion: existingOrder.consentVersion
      });
      const incomingFingerprint = computeCheckoutFingerprint({
        name,
        amount: parsedAmount,
        customerPhone: phoneStr,
        customerEmail: validCustomerEmail,
        profileId,
        instagram,
        linkedin,
        website,
        twitter,
        reason,
        lazyReason,
        consentAccepted,
        consentVersion
      });

      const ownerTokenMatch = existingOrder.ownerTokenHash
        ? (providedToken && verifyOwnerToken(existingOrder.ownerTokenHash, providedToken))
        : true;
      const accessTokenMatch = existingOrder.orderAccessTokenHash
        ? (clientOrderAccessToken && constantTimeMatch(existingOrder.orderAccessTokenHash, hashToken(clientOrderAccessToken)))
        : true;

      if (existingFingerprint !== incomingFingerprint || !ownerTokenMatch || !accessTokenMatch) {
        return res.status(409).json({
          error: 'Idempotency conflict: order parameters differ for this idempotency key.'
        });
      }

      // If internal order exists but paymentSessionId is absent (e.g. after provider timeout), safely recover/reconcile session
      // Uses the existing order's pinned provider (Sticky Orders)
      if (!existingOrder.paymentSessionId) {
        try {
          const targetProvider = paymentManager.getProviderFor(existingOrder.provider);
          const providerOrder = await targetProvider.createOrder({
            orderId: existingOrder.orderId,
            amount: existingOrder.chargeCurrency === 'USD' ? (existingOrder.chargeAmountMinor || 500) / 100 : Number(existingOrder.amount),
            currency: existingOrder.chargeCurrency || existingOrder.currency || 'INR',
            customerName: existingOrder.name,
            customerEmail: existingOrder.customerEmail,
            customerPhone: existingOrder.customerPhone || phoneStr,
            returnUrl: `https://lazyproof.online/?order_id=${existingOrder.orderId}&status=return`,
            notifyUrl: `https://lazyproof.online/api/payment/webhook`,
            note: `Digital sponsored profile placement on LazyProof - ${existingOrder.name}`,
            idempotencyKey
          });

          await db.updateOrderProviderSession(
            existingOrder.orderId,
            providerOrder.paymentSessionId,
            providerOrder.providerOrderId,
            providerOrder.checkoutUrl
          );

          existingOrder.paymentSessionId = providerOrder.paymentSessionId;
          existingOrder.providerOrderId = providerOrder.providerOrderId;
          existingOrder.checkoutUrl = providerOrder.checkoutUrl;
        } catch (recoverErr: any) {
          console.error('[PaymentManager] Recovery of paymentSessionId failed on retry:', recoverErr);
          return res.status(502).json({
            error: recoverErr?.message || 'Payment gateway order session generation failed.',
            orderId: existingOrder.orderId,
            idempotencyKey,
            recoverable: true
          });
        }
      }

      const isExistingTop = Number(existingOrder.amount) > topAmount;
      return res.json({
        orderId: existingOrder.orderId,
        paymentSessionId: existingOrder.paymentSessionId,
        checkoutUrl: existingOrder.checkoutUrl,
        providerOrderId: existingOrder.providerOrderId,
        provider: existingOrder.provider || intentProvider.name,
        idempotencyKey,
        name: existingOrder.name,
        amount: existingOrder.amount,
        currency: existingOrder.chargeCurrency || existingOrder.currency || 'INR',
        chargeAmountMinor: existingOrder.chargeAmountMinor || existingOrder.amount * 100,
        canonicalRankCreditPaise: existingOrder.canonicalRankCreditPaise || existingOrder.amount * 100,
        isTop: isExistingTop,
        topAmount,
        minAmountToBeatTop,
        profileId: existingOrder.profileId,
        paymentMode: existingOrder.paymentMode,
        quote: existingOrder.quoteSnapshot || quoteSnapshot,
        instagram: existingOrder.instagram,
        linkedin: existingOrder.linkedin,
        website: existingOrder.website,
        twitter: existingOrder.twitter,
        reason: existingOrder.reason,
        lazyReason: existingOrder.lazyReason
      });
    }

    const orderId = 'order_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);

    // Authoritative server-side order registration and atomic quote consumption
    const cleanQuoteId = reqQuoteId ? String(reqQuoteId).trim() : undefined;
    const expectedAuthHash = cleanQuoteId ? crypto.createHash('sha256').update(
      `${cleanQuoteId}:${chargeAmountMinor}:${chargeCurrency}:${profileId ? 'upgrade' : 'new'}:${profileId || 'new'}:${clientIp}`
    ).digest('hex') : undefined;

    try {
      const atomicRes = await db.createOrderWithQuoteAtomicAsync(
        {
          orderId,
          name: name.trim(),
          amount: parsedAmount,
          currency: 'INR',
          chargeCurrency,
          chargeAmountMinor,
          canonicalRankCreditPaise,
          fxQuoteId,
          profileId,
          provider: intentProvider.name,
          ownerToken: providedToken,
          orderAccessToken: clientOrderAccessToken,
          quoteSnapshot,
          instagram: db.normalizeInstagram(instagram),
          linkedin: db.normalizeLinkedIn(linkedin),
          website: db.normalizeWebsite(website),
          twitter: db.normalizeTwitter(twitter),
          reason: reason?.trim(),
          lazyReason: lazyReason?.trim(),
          idempotencyKey,
          paymentMode: paymentManager.getMode(),
          customerEmail: validCustomerEmail,
          customerPhone: phoneStr,
          consentAccepted: true,
          consentTimestamp: new Date().toISOString(),
          consentVersion: consentVersion || CURRENT_CONSENT_VERSION
        },
        cleanQuoteId ? {
          quoteId: cleanQuoteId,
          authHash: expectedAuthHash,
          currency: chargeCurrency,
          amountMinor: chargeAmountMinor
        } : undefined
      );

      if (!atomicRes.success) {
        const errCode = atomicRes.error || 'INVALID_QUOTE';
        const statusCode = errCode === 'QUOTE_ALREADY_CONSUMED' ? 409 : (errCode === 'QUOTE_NOT_FOUND' ? 404 : 400);
        return res.status(statusCode).json({
          error: `Quote consumption failed: ${errCode}`,
          code: errCode
        });
      }
    } catch (createErr: any) {
      if (createErr?.code === '23505' || createErr?.message?.includes('duplicate key') || createErr?.message?.includes('idempotency')) {
        const concurrentOrder = await db.getOrderByIdempotencyKey(idempotencyKey);
        if (concurrentOrder) {
          const isExistingTop = concurrentOrder.amount > topAmount;
          const concurrentFingerprint = computeCheckoutFingerprint({
            name: concurrentOrder.name,
            amount: concurrentOrder.amount,
            customerPhone: concurrentOrder.customerPhone,
            customerEmail: concurrentOrder.customerEmail,
            profileId: concurrentOrder.profileId,
            instagram: concurrentOrder.instagram,
            linkedin: concurrentOrder.linkedin,
            website: concurrentOrder.website,
            twitter: concurrentOrder.twitter,
            reason: concurrentOrder.reason,
            lazyReason: concurrentOrder.lazyReason,
            consentAccepted: concurrentOrder.consentAccepted,
            consentVersion: concurrentOrder.consentVersion
          });
          const incomingFingerprint = computeCheckoutFingerprint({
            name,
            amount: parsedAmount,
            customerPhone: phoneStr,
            customerEmail: validCustomerEmail,
            profileId,
            instagram,
            linkedin,
            website,
            twitter,
            reason,
            lazyReason,
            consentAccepted,
            consentVersion
          });

          const ownerTokenMatch = concurrentOrder.ownerTokenHash
            ? (providedToken && verifyOwnerToken(concurrentOrder.ownerTokenHash, providedToken))
            : true;
          const accessTokenMatch = concurrentOrder.orderAccessTokenHash
            ? (clientOrderAccessToken && constantTimeMatch(concurrentOrder.orderAccessTokenHash, hashToken(clientOrderAccessToken)))
            : true;

          if (concurrentFingerprint !== incomingFingerprint || !ownerTokenMatch || !accessTokenMatch) {
            return res.status(409).json({
              error: 'Idempotency conflict: order parameters differ for this idempotency key.'
            });
          }

          if (!concurrentOrder.paymentSessionId) {
            try {
              const targetProvider = paymentManager.getProviderFor(concurrentOrder.provider);
              const providerOrder = await targetProvider.createOrder({
                orderId: concurrentOrder.orderId,
                amount: concurrentOrder.chargeCurrency === 'USD' ? (concurrentOrder.chargeAmountMinor || 500) / 100 : Number(concurrentOrder.amount),
                currency: concurrentOrder.chargeCurrency || concurrentOrder.currency || 'INR',
                customerName: concurrentOrder.name,
                customerEmail: concurrentOrder.customerEmail,
                customerPhone: concurrentOrder.customerPhone || phoneStr,
                returnUrl: `https://lazyproof.online/?order_id=${concurrentOrder.orderId}&status=return`,
                notifyUrl: `https://lazyproof.online/api/payment/webhook`,
                note: `Digital sponsored profile placement on LazyProof - ${concurrentOrder.name}`,
                idempotencyKey
              });

              await db.updateOrderProviderSession(
                concurrentOrder.orderId,
                providerOrder.paymentSessionId,
                providerOrder.providerOrderId,
                providerOrder.checkoutUrl
              );

              concurrentOrder.paymentSessionId = providerOrder.paymentSessionId;
              concurrentOrder.providerOrderId = providerOrder.providerOrderId;
              concurrentOrder.checkoutUrl = providerOrder.checkoutUrl;
            } catch (concurrentSessionErr: any) {
              return res.status(502).json({
                error: concurrentSessionErr?.message || 'Payment gateway order session generation failed.',
                orderId: concurrentOrder.orderId,
                idempotencyKey,
                recoverable: true
              });
            }
          }

          return res.json({
            orderId: concurrentOrder.orderId,
            paymentSessionId: concurrentOrder.paymentSessionId,
            checkoutUrl: concurrentOrder.checkoutUrl,
            providerOrderId: concurrentOrder.providerOrderId,
            provider: concurrentOrder.provider || intentProvider.name,
            idempotencyKey,
            name: concurrentOrder.name,
            amount: concurrentOrder.amount,
            currency: concurrentOrder.chargeCurrency || concurrentOrder.currency || 'INR',
            chargeAmountMinor: concurrentOrder.chargeAmountMinor || concurrentOrder.amount * 100,
            canonicalRankCreditPaise: concurrentOrder.canonicalRankCreditPaise || concurrentOrder.amount * 100,
            isTop: isExistingTop,
            topAmount,
            minAmountToBeatTop,
            profileId: concurrentOrder.profileId,
            paymentMode: concurrentOrder.paymentMode,
            quote: concurrentOrder.quoteSnapshot || quoteSnapshot,
            instagram: concurrentOrder.instagram,
            linkedin: concurrentOrder.linkedin,
            website: concurrentOrder.website,
            twitter: concurrentOrder.twitter,
            reason: concurrentOrder.reason,
            lazyReason: concurrentOrder.lazyReason
          });
        }
      }
      throw createErr;
    }

    try {
      const providerOrder = await intentProvider.createOrder({
        orderId,
        amount: chargeCurrency === 'USD' ? chargeAmountMinor / 100 : parsedAmount,
        currency: chargeCurrency,
        customerName: name.trim(),
        customerEmail: validCustomerEmail,
        customerPhone: phoneStr,
        returnUrl: `https://lazyproof.online/?order_id=${orderId}&status=return`,
        notifyUrl: `https://lazyproof.online/api/payment/webhook`,
        note: `Digital sponsored profile placement on LazyProof - ${name.trim()}`,
        idempotencyKey
      });

      await db.updateOrderProviderSession(
        orderId,
        providerOrder.paymentSessionId,
        providerOrder.providerOrderId,
        providerOrder.checkoutUrl
      );

      res.json({
        orderId,
        paymentSessionId: providerOrder.paymentSessionId,
        checkoutUrl: providerOrder.checkoutUrl,
        providerOrderId: providerOrder.providerOrderId,
        provider: intentProvider.name,
        idempotencyKey,
        name: name.trim(),
        amount: parsedAmount,
        currency: chargeCurrency,
        chargeAmountMinor,
        canonicalRankCreditPaise,
        isTop,
        topAmount,
        minAmountToBeatTop,
        profileId,
        paymentMode: paymentManager.getMode(),
        quote: quoteSnapshot,
        instagram: db.normalizeInstagram(instagram),
        linkedin: db.normalizeLinkedIn(linkedin),
        website: db.normalizeWebsite(website),
        twitter: db.normalizeTwitter(twitter),
        reason: reason?.trim(),
        lazyReason: lazyReason?.trim()
      });
    } catch (err: any) {
      console.error('[PaymentManager] Provider createOrder error:', err);
      res.status(502).json({
        error: err?.message || 'Payment gateway order session generation failed.',
        orderId,
        idempotencyKey,
        recoverable: true
      });
    }
  }));

  // Server-side Payment Verification (Authoritative: grants rank only upon verified order & payment)
  app.post('/api/payment/verify', (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 25, 60000)) {
      return res.status(429).json({ error: 'Too many verification attempts. Please slow down.' });
    }

    const { paymentReference, orderId, instagram, linkedin, website, reason, profileId } = req.body;

    if (paymentManager.getMode() === 'disabled') {
      return res.status(503).json({
        error: 'Payments are currently unavailable until payment processing is enabled.',
        paymentMode: 'disabled'
      });
    }

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'Order ID is required for payment verification.' });
    }

    const order = db.getOrder(orderId);
    if (!order) {
      return res.status(400).json({ error: 'Invalid or expired payment order ID.' });
    }

    // STRICT PAYMENT CAPABILITY CHECK ON EXISTING ORDER
    if (!paymentManager.mayVerifyExistingOrder(order)) {
      return res.status(503).json({
        error: 'Payments are currently unavailable until payment processing is enabled.',
        paymentMode: 'disabled'
      });
    }

    // If order was already completed by the provider webhook
    if (order.status === 'completed' || order.status === 'PAID') {
      const prof = order.profileId ? db.getProfile(order.profileId) : undefined;
      if (prof) {
        return res.json({
          success: true,
          message: 'Legitimacy Verified via Provider Settlement.',
          profile: db.sanitizeProfile(prof)
        });
      }
      return res.status(400).json({ error: 'This payment order has already been verified and claimed.' });
    }

    const effectivePaymentRef = (paymentReference || '').trim();
    if (!effectivePaymentRef) {
      return res.status(400).json({ error: 'Valid payment reference is required.' });
    }

    const cleanRef = effectivePaymentRef.slice(0, 100);
    if (db.isPaymentRefProcessed(cleanRef)) {
      return res.status(400).json({ error: 'Payment reference has already been processed.' });
    }

    if (process.env.NODE_ENV === 'production' || db.isPostgresAuthoritative()) {
      return res.status(403).json({
        error: 'Direct client-side verification is disabled in production. Payments must settle via verified gateway webhook or server status verification.'
      });
    }

    const ownerToken = order.ownerToken || (req.headers['x-profile-token'] as string) || req.body?.ownerToken;

    // Authoritative values derived from the server order record
    const result = db.verifyAndClaimRank({
      name: order.name,
      amount: order.amount,
      paymentRef: cleanRef,
      orderId,
      instagram: order.instagram || instagram,
      linkedin: order.linkedin || linkedin,
      website: order.website || website,
      reason: order.reason || reason,
      lazyReason: order.lazyReason || req.body.lazyReason,
      profileId: order.profileId || profileId,
      ownerToken
    });

    if (!result.success || !result.profile) {
      return res.status(400).json({ error: result.message || 'Payment verification failed.' });
    }

    res.json({
      success: true,
      message: 'Legitimacy Verified.',
      profile: db.sanitizeProfile(result.profile),
      previousTop: result.previousTop ? db.sanitizeProfile(result.previousTop) : undefined
    });
  });

  // Razorpay Client Standard Checkout completion verification endpoint
  app.post('/api/payment/razorpay/complete', asyncHandler(async (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 20, 60000)) {
      return res.status(429).json({ error: 'Too many completion requests. Please slow down.' });
    }

    const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    if (!orderId || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing required Razorpay completion parameters.' });
    }

    const order = await db.getOrderAsync(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Authorization check
    const clientAccessToken = (req.headers['x-order-access-token'] as string) || req.body.orderAccessToken;
    if (!clientAccessToken || !order.orderAccessTokenHash || !constantTimeMatch(order.orderAccessTokenHash, hashToken(clientAccessToken))) {
      return res.status(403).json({ error: 'Unauthorized: Valid order access token is required.' });
    }

    if (order.status === 'completed' || order.status === 'PAID') {
      const existingProfile = order.profileId ? (db.isPostgresAuthoritative() ? await db.pg.getProfile(order.profileId) : db.getProfile(order.profileId)) : undefined;
      return res.json({
        success: true,
        message: 'Order already completed.',
        profile: existingProfile ? db.sanitizeProfile(existingProfile) : undefined
      });
    }

    const rzpProvider = paymentManager.getProviderFor('razorpay') as any;
    // Verify client signature using server-stored providerOrderId (reject substitution)
    if (order.providerOrderId && order.providerOrderId !== razorpay_order_id) {
      return res.status(400).json({ error: 'Razorpay order ID mismatch.' });
    }

    const isSigValid = rzpProvider.verifyCheckoutSignature({
      razorpayOrderId: order.providerOrderId || razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature
    });

    if (!isSigValid) {
      return res.status(400).json({ error: 'Invalid Razorpay payment signature.' });
    }

    // Server-to-server payment check
    const statusResult = await rzpProvider.getPaymentStatus(razorpay_payment_id);
    if (statusResult.status !== 'PAID') {
      return res.status(400).json({ error: 'Payment is not in captured PAID status.' });
    }
    if (statusResult.currency !== 'INR') {
      return res.status(400).json({ error: 'Currency mismatch against INR.' });
    }
    const expectedPaise = order.chargeAmountMinor || toSafePaise(order.amount);
    const paidPaise = toSafePaise(statusResult.amount);
    if (expectedPaise === null || paidPaise === null || expectedPaise !== paidPaise) {
      return res.status(400).json({ error: 'Amount mismatch between Razorpay payment and order.' });
    }

    // Atomic settlement
    if (db.isPostgresAuthoritative()) {
      const settlement = await db.pg.settlePaymentAtomic({
        orderId,
        providerPaymentId: razorpay_payment_id.trim(),
        provider: 'razorpay',
        amount: paidPaise / 100,
        currency: 'INR',
        status: 'PAID',
        paymentMethod: statusResult.paymentMethod || 'Razorpay',
        signatureVerified: true
      });
      if (!settlement.success || !settlement.profile) {
        return res.status(503).json({ error: settlement.message || 'Settlement failed.' });
      }
      return res.json({
        success: true,
        message: 'Payment verified and claimed.',
        profile: db.sanitizeProfile(settlement.profile)
      });
    } else {
      const result = db.verifyAndClaimRank({
        name: order.name,
        amount: paidPaise / 100,
        paymentRef: razorpay_payment_id.trim(),
        orderId,
        instagram: order.instagram,
        linkedin: order.linkedin,
        website: order.website,
        reason: order.reason,
        lazyReason: order.lazyReason,
        profileId: order.profileId,
        ownerToken: order.ownerToken
      });
      if (!result.success || !result.profile) {
        return res.status(503).json({ error: result.message || 'Settlement failed.' });
      }
      return res.json({
        success: true,
        message: 'Payment verified and claimed.',
        profile: db.sanitizeProfile(result.profile)
      });
    }
  }));

  // Client polling endpoint: Authoritative status check
  app.get('/api/payment/status/:orderId', asyncHandler(async (req: Request, res: Response) => {
    const orderId = req.params.orderId;
    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'Order ID is required.' });
    }
    const order = await db.getOrderAsync(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Require valid access credentials
    const access = verifyOrderReadAccess(order, req);
    if (!access.allowed) {
      return res.status(access.status || 403).json({ error: access.error });
    }
    res.setHeader('Cache-Control', 'no-store');

    const profile = order.profileId
      ? (db.isPostgresAuthoritative() ? await db.pg.getProfile(order.profileId) : db.getProfile(order.profileId))
      : undefined;

    // Return authoritative stored terminal/refund/chargeback state directly (never re-settle or downgrade)
    if (['REFUNDED', 'PARTIALLY_REFUNDED', 'REFUND_PENDING', 'CHARGEBACK', 'FAILED', 'CANCELLED'].includes(order.status)) {
      return res.json({
        orderId,
        status: order.status,
        profile: profile ? db.sanitizeProfile(profile) : undefined
      });
    }

    if (order.status === 'completed' || order.status === 'PAID') {
      return res.json({
        orderId,
        status: 'PAID',
        profile: profile ? db.sanitizeProfile(profile) : undefined
      });
    }

    // Allow initial settlement ONLY from CREATED/PENDING with exact INR paise checks
    if (paymentManager.mayVerifyExistingOrder(order) && (order.status === 'CREATED' || order.status === 'PENDING')) {
      try {
        const orderProvider = paymentManager.getProviderFor(order.provider);
        const providerStatus = await orderProvider.getPaymentStatus(orderId);
        if (providerStatus.status === 'PAID') {
          const isUsd = (order.chargeCurrency || order.currency) === 'USD';
          let verifiedAmountINR = Number(order.amount);

          if (isUsd) {
            const providerCents = Math.round(Number(providerStatus.amount) * 100);
            const orderCents = order.chargeAmountMinor || Math.round(Number(order.amount) * 100);
            if (!providerStatus.providerPaymentId || providerStatus.currency !== 'USD' || providerCents !== orderCents) {
              return res.status(409).json({ error: 'Provider payment verification mismatch against registered order.' });
            }
            verifiedAmountINR = order.amount;
          } else {
            const providerPaise = toSafePaise(providerStatus.amount);
            const orderPaise = order.chargeAmountMinor || toSafePaise(order.amount);
            if (!providerStatus.providerPaymentId || providerStatus.currency !== 'INR' ||
                providerPaise === null || orderPaise === null || providerPaise !== orderPaise) {
              return res.status(409).json({ error: 'Provider payment verification mismatch against registered order.' });
            }
            verifiedAmountINR = providerPaise / 100;
          }

          if (db.isPostgresAuthoritative()) {
            const settlement = await db.pg.settlePaymentAtomic({
              orderId,
              providerPaymentId: providerStatus.providerPaymentId.trim(),
              provider: order.provider || orderProvider.name,
              amount: verifiedAmountINR,
              currency: 'INR',
              status: 'PAID',
              paymentMethod: providerStatus.paymentMethod || 'UPI',
              signatureVerified: false
            });
            if (settlement.success && settlement.profile) {
              return res.json({
                orderId,
                status: 'PAID',
                profile: db.sanitizeProfile(settlement.profile)
              });
            }
          } else {
            const result = db.verifyAndClaimRank({
              name: order.name,
              amount: verifiedAmountINR,
              paymentRef: providerStatus.providerPaymentId,
              orderId,
              instagram: order.instagram,
              linkedin: order.linkedin,
              website: order.website,
              reason: order.reason,
              lazyReason: order.lazyReason,
              profileId: order.profileId,
              ownerToken: order.ownerToken
            });
            if (result.success && result.profile) {
              return res.json({
                orderId,
                status: 'PAID',
                profile: db.sanitizeProfile(result.profile)
              });
            }
          }
        }
        return res.json({
          orderId,
          status: providerStatus.status
        });
      } catch {
        // Fall back to order record
      }
    }

    return res.json({
      orderId,
      status: order.status || 'PENDING'
    });
  }));

  // Digital Service Payment Receipt Endpoint
  app.get('/api/payment/receipt/:orderId', asyncHandler(async (req: Request, res: Response) => {
    const orderId = req.params.orderId;
    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'Order ID is required.' });
    }
    const order = await db.getOrderAsync(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Require valid access credentials
    const access = verifyOrderReadAccess(order, req);
    if (!access.allowed) {
      return res.status(access.status || 403).json({ error: access.error });
    }
    res.setHeader('Cache-Control', 'no-store');

    res.json({
      receiptId: 'REC-' + order.orderId.toUpperCase(),
      operator: SERVER_LEGAL_CONFIG.LEGAL_BUSINESS_NAME,
      entityType: SERVER_LEGAL_CONFIG.ENTITY_TYPE,
      proprietor: SERVER_LEGAL_CONFIG.PROPRIETOR_NAME,
      brand: SERVER_LEGAL_CONFIG.BRAND_NAME,
      website: SERVER_LEGAL_CONFIG.APP_URL,
      supportEmail: SERVER_LEGAL_CONFIG.SUPPORT_EMAIL,
      supportPhone: SERVER_LEGAL_CONFIG.SUPPORT_PHONE,
      businessAddress: SERVER_LEGAL_CONFIG.PUBLIC_BUSINESS_ADDRESS,
      orderId: order.orderId,
      paymentReference: order.paymentRef || 'PENDING_CONFIRMATION',
      paymentStatus: (order.status === 'completed' || order.status === 'PAID') ? 'PAID' : (order.status || 'PENDING'),
      customerName: order.name,
      serviceDescription: SERVER_LEGAL_CONFIG.SERVICE_DESCRIPTION,
      rankingDynamic: SERVER_LEGAL_CONFIG.RANKING_DYNAMIC,
      amount: order.amount,
      currency: 'INR',
      taxTreatment: 'This is a payment/service receipt and not a GST tax invoice unless a valid tax invoice is separately issued where applicable.',
      timestamp: order.createdAt || new Date().toISOString()
    });
  }));

  // Authoritative Provider Webhooks (Dedicated and backwards-compatible routes)
  const handleWebhook = async (req: Request, res: Response, expectedProvider?: string) => {
    const clientIp = getClientIp(req);
    // Rate limit pre-signature checks: protect HMAC computation against unauthenticated floods.
    // Provider webhooks are authenticated via HMAC; valid signed webhooks rely on durable DB idempotency,
    // bounded payload size (100kb), and authoritative reconciliation.
    // Allow up to 300 requests/minute per provider IP to safely handle legitimate retry/burst traffic from shared IPs.
    if (!checkRateLimit(`webhook_pre_${clientIp}`, 300, 60000)) {
      return res.status(429).json({ error: 'Too many webhook requests from this origin.' });
    }

    if (paymentManager.getMode() === 'disabled') {
      return res.status(503).json({
        error: 'Payments are currently unavailable until payment processing is enabled.',
        paymentMode: 'disabled'
      });
    }

    const rawBodyBuf = (req as any).rawBody;
    if (!rawBodyBuf || rawBodyBuf.length === 0) {
      return res.status(400).json({ error: 'Missing raw webhook request body.' });
    }
    const rawBodyStr = rawBodyBuf.toString('utf8');

    // Authoritative Webhook Signature Enforcement & Header Isolation
    let webhookProvider: any;
    let headerWebhookId: string | undefined;

    if (expectedProvider === 'dodo') {
      if (req.headers['x-razorpay-signature'] || req.headers['x-razorpay-event-id']) {
        return res.status(400).json({ error: 'Conflicting provider headers: Razorpay header received on Dodo webhook route.' });
      }
      webhookProvider = paymentManager.getProviderFor('dodo');
      const dodoId = req.headers['webhook-id'];
      const dodoTimestamp = req.headers['webhook-timestamp'];
      const dodoSignature = req.headers['webhook-signature'];
      if (!dodoId || !dodoTimestamp || !dodoSignature) {
        checkRateLimit(`webhook_invalid_${clientIp}`, 30, 60000);
        return res.status(401).json({ error: 'Missing authoritative Dodo webhook signature headers.' });
      }
      headerWebhookId = typeof dodoId === 'string' ? dodoId : undefined;
    } else if (expectedProvider === 'razorpay') {
      if (req.headers['webhook-signature'] || req.headers['webhook-id']) {
        return res.status(400).json({ error: 'Conflicting provider headers: Dodo header received on Razorpay webhook route.' });
      }
      webhookProvider = paymentManager.getProviderFor('razorpay');
      const rzpSignature = req.headers['x-razorpay-signature'];
      if (!rzpSignature) {
        checkRateLimit(`webhook_invalid_${clientIp}`, 30, 60000);
        return res.status(401).json({ error: 'Missing authoritative Razorpay webhook signature header.' });
      }
      const rzpEventId = req.headers['x-razorpay-event-id'];
      headerWebhookId = typeof rzpEventId === 'string' ? rzpEventId : undefined;
    } else {
      if (req.headers['x-razorpay-signature']) {
        webhookProvider = paymentManager.getProviderFor('razorpay');
        const rzpEventId = req.headers['x-razorpay-event-id'];
        headerWebhookId = typeof rzpEventId === 'string' ? rzpEventId : undefined;
      } else if (req.headers['webhook-signature'] || req.headers['webhook-id']) {
        webhookProvider = paymentManager.getProviderFor('dodo');
        const dodoId = req.headers['webhook-id'];
        headerWebhookId = typeof dodoId === 'string' ? dodoId : undefined;
      } else {
        if ((paymentManager.getMode() === 'live' || process.env.NODE_ENV === 'production') && !req.headers['x-webhook-timestamp']) {
          return res.status(400).json({ error: 'Generic webhook settlement is disabled in production/live mode.' });
        }
        webhookProvider = paymentManager.getProviderFor('cashfree');
        const webhookTimestamp = req.headers['x-webhook-timestamp'];
        const webhookSignature = req.headers['x-webhook-signature'];
        if (!webhookTimestamp || !webhookSignature) {
          checkRateLimit(`webhook_invalid_${clientIp}`, 30, 60000);
          return res.status(401).json({ error: 'Missing authoritative Cashfree webhook signature headers.' });
        }
        const cfId = req.headers['x-webhook-id'];
        headerWebhookId = typeof cfId === 'string' ? cfId : undefined;
      }
    }

    if (!paymentManager.mayProcessWebhook(webhookProvider.name)) {
      return res.status(503).json({ error: `Payment webhook processing is currently disabled for provider ${webhookProvider.name}.` });
    }

    const verification = await webhookProvider.verifyWebhook(rawBodyStr, req.headers as any);
    if (!verification.isValid) {
      checkRateLimit(`webhook_invalid_${clientIp}`, 30, 60000);
      return res.status(401).json({
        error: verification.error || `Invalid ${webhookProvider.name} webhook signature.`
      });
    }

    // Generate namespaced event ID
    let eventId: string;
    if (typeof headerWebhookId === 'string' && headerWebhookId.trim().length > 0 && headerWebhookId.trim().length <= 128) {
      eventId = `${webhookProvider.name}_${headerWebhookId.trim()}`;
    } else {
      eventId = `wh_${webhookProvider.name}_${crypto.createHash('sha256').update(rawBodyBuf).digest('hex').slice(0, 32)}`;
    }

    // Fast-path deduplication: if this exact webhook event was already recorded, acknowledge immediately
    if (await db.isWebhookEventProcessed(eventId)) {
      return res.json({ received: true, processed: true, duplicate: true, message: 'Webhook event already processed.' });
    }

    if ((verification.status === 'REFUNDED' || verification.refund) && verification.orderId) {
      const orderId = verification.orderId;
      const refundDetails = verification.refund;
      const merchantRefundId = refundDetails?.refundId;
      let providerRefundId = refundDetails?.providerRefundId;
      const refundAmount = refundDetails?.amount ?? verification.amount ?? 0;
      const refundStatus = refundDetails?.status || (verification.status === 'REFUNDED' ? 'SUCCESS' : 'FAILED');

      if (!merchantRefundId) {
        return res.status(400).json({ error: 'Cannot reconcile refund without merchant refund ID.' });
      }

      const isUsdRefund = (refundDetails?.currency || verification.currency) === 'USD';
      if (!isUsdRefund) {
        const refundCurrency = refundDetails?.currency || verification.currency || '';
        if (refundCurrency !== 'INR') {
          return res.status(400).json({ error: 'Refund currency mismatch against INR.' });
        }
      }

      if (refundStatus === 'SUCCESS') {
        const refundOrder = await db.getOrderAsync(orderId);
        if (refundOrder?.provider && refundOrder.provider !== webhookProvider.name) {
          return res.status(409).json({ error: 'Webhook provider does not match registered order provider.' });
        }
        const refundProvider = paymentManager.getProviderFor(refundOrder?.provider || webhookProvider.name);
        if (paymentManager.mayReconcileExistingPayment(refundOrder || { provider: webhookProvider.name }) && refundProvider?.isConfigured()) {
          try {
            const authStatus = await refundProvider.getRefundStatus(orderId, merchantRefundId);
            const expectedCurrency = isUsdRefund ? 'USD' : 'INR';
            if (
              authStatus.status !== 'SUCCESS' ||
              authStatus.orderId !== orderId ||
              authStatus.merchantRefundId !== merchantRefundId ||
              authStatus.currency !== expectedCurrency ||
              toSafePaise(authStatus.amount) !== toSafePaise(refundAmount)
            ) {
              console.warn(`[Webhook Refund] Authoritative verification mismatch for order ${sanitizeLog(orderId)} / refund ${sanitizeLog(merchantRefundId)}. Reservation preserved as PENDING.`);
              await db.recordWebhookEvent(eventId, verification.event || 'REFUND_STATUS_MISMATCH', orderId, providerRefundId, verification.rawPayload);
              return res.status(409).json({ error: 'Authoritative refund verification mismatch. Reservation preserved as PENDING.' });
            }
            providerRefundId = authStatus.providerRefundId || providerRefundId;
          } catch (authErr: any) {
            console.warn('[Webhook Refund] Server-to-server verification failed for order %s: %s', sanitizeLog(orderId), sanitizeLog(authErr?.message || authErr));
            return res.status(503).json({ error: 'Server-to-server refund verification unavailable. Retry later.' });
          }
        }

        const reversed = await db.reverseRefund(
          orderId,
          refundAmount,
          `${refundOrder?.provider || webhookProvider.name} webhook refund confirmation`,
          merchantRefundId,
          providerRefundId,
          isUsdRefund ? 'USD' : 'INR'
        );
        if (!reversed) {
          return res.status(503).json({ error: 'Refund reversal failed to reconcile in database.' });
        }
        await db.recordWebhookEvent(eventId, verification.event || 'REFUND_SUCCESS_WEBHOOK', orderId, providerRefundId, verification.rawPayload);
        return res.json({ received: true, processed: true, status: 'REFUNDED' });
      } else if (refundStatus === 'FAILED') {
        if (db.isPostgresAuthoritative()) {
          await db.pg.failRefundReservation(merchantRefundId, orderId);
        }
        await db.recordWebhookEvent(eventId, verification.event || 'REFUND_FAILED_WEBHOOK', orderId, providerRefundId, verification.rawPayload);
        return res.json({ received: true, processed: true, status: 'FAILED' });
      } else {
        await db.recordWebhookEvent(eventId, verification.event || 'REFUND_PENDING_WEBHOOK', orderId, providerRefundId, verification.rawPayload);
        return res.json({ received: true, processed: true, status: 'PENDING' });
      }
    }

    if (verification.status === 'SUCCESS' && verification.orderId && verification.providerPaymentId) {
      const orderId = verification.orderId;
      const order = await db.getOrderAsync(orderId);
      if (!order) {
        return res.status(404).json({ error: 'Referenced order not found.' });
      }
      if (order.provider && order.provider !== webhookProvider.name) {
        return res.status(409).json({ error: 'Incoming webhook provider does not match registered order provider.' });
      }
      if (order.status === 'completed' || order.status === 'PAID') {
        const existingPaymentRef = order.paymentRef || (order as any).providerPaymentId;
        if (existingPaymentRef && verification.providerPaymentId !== existingPaymentRef) {
          return res.status(409).json({ error: 'Payment ID mismatch on already-paid order.' });
        }
        await db.recordWebhookEvent(eventId, verification.event || 'PAYMENT_SUCCESS_WEBHOOK', orderId, verification.providerPaymentId, verification.rawPayload);
        return res.json({ received: true, processed: true, message: 'Order already completed.' });
      }

      let providerPaymentId = verification.providerPaymentId;
      let paymentMethod = verification.paymentMethod || 'UPI';
      let verifiedAmountINR = order.amount;

      const orderProvider = paymentManager.getProviderFor(order.provider || webhookProvider.name);

      if (paymentManager.mayVerifyExistingOrder(order)) {
        const providerStatus = await orderProvider.getPaymentStatus(orderId);
        if (providerStatus.status !== 'PAID' || !providerStatus.providerPaymentId) {
          return res.status(503).json({ error: 'Gateway payment record not in PAID state.' });
        }

        const isUsd = (order.chargeCurrency || order.currency) === 'USD';
        if (isUsd) {
          if (providerStatus.currency !== 'USD' || (verification.currency && verification.currency !== 'USD')) {
            return res.status(400).json({ error: 'Payment currency mismatch against USD.' });
          }
          const providerCents = Math.round(Number(providerStatus.amount) * 100);
          const orderCents = order.chargeAmountMinor || Math.round(Number(order.amount) * 100);
          if (providerCents !== orderCents) {
            return res.status(400).json({ error: 'Payment amount mismatch against order record.' });
          }
          verifiedAmountINR = order.amount; // canonical rank INR
        } else {
          if (providerStatus.currency !== 'INR' || order.currency !== 'INR' || (verification.currency && verification.currency !== 'INR')) {
            return res.status(400).json({ error: 'Payment currency mismatch against INR.' });
          }

          const providerPaise = toSafePaise(providerStatus.amount);
          const webhookPaise = verification.amount !== undefined ? toSafePaise(verification.amount) : null;
          const orderPaise = order.chargeAmountMinor || toSafePaise(order.amount);

          if (providerPaise === null || orderPaise === null || providerPaise !== orderPaise) {
            return res.status(400).json({ error: 'Payment amount mismatch against order record.' });
          }
          if (webhookPaise !== null && webhookPaise !== orderPaise) {
            return res.status(400).json({ error: 'Webhook payload amount mismatch against order record.' });
          }

          verifiedAmountINR = providerPaise / 100;
        }

        providerPaymentId = providerStatus.providerPaymentId;
        paymentMethod = providerStatus.paymentMethod || paymentMethod;
      }

      if (db.isPostgresAuthoritative()) {
        const settlementResult = await db.pg.settlePaymentAtomic({
          orderId,
          providerPaymentId: providerPaymentId.trim(),
          provider: order.provider || webhookProvider.name,
          amount: verifiedAmountINR,
          currency: 'INR',
          status: 'PAID',
          paymentMethod,
          signatureVerified: true,
          rawPayload: verification.rawPayload
        });

        if (!settlementResult.success || !settlementResult.profile) {
          return res.status(503).json({ error: settlementResult.message || 'Payment settlement failed.' });
        }

        try {
          await db.recordWebhookEvent(eventId, verification.event || 'PAYMENT_SUCCESS_WEBHOOK', orderId, providerPaymentId, verification.rawPayload);
        } catch (eventErr) {
          console.error('[Webhook] Failed to record event after settlement:', eventErr);
          return res.status(503).json({ error: 'Settlement completed but failed to record webhook event.' });
        }

        return res.json({
          received: true,
          processed: true,
          profileId: settlementResult.profile.id,
          rank: settlementResult.profile.rank
        });
      }

      const result = db.verifyAndClaimRank({
        name: order.name,
        amount: verifiedAmountINR,
        paymentRef: providerPaymentId,
        orderId,
        instagram: order.instagram,
        linkedin: order.linkedin,
        website: order.website,
        reason: order.reason,
        lazyReason: order.lazyReason,
        profileId: order.profileId,
        ownerToken: order.ownerToken
      });

      if (!result.success || !result.profile) {
        return res.status(503).json({ error: result.message || 'Payment claim failed.' });
      }

      await db.recordWebhookEvent(eventId, verification.event || 'PAYMENT_SUCCESS_WEBHOOK', orderId, providerPaymentId, verification.rawPayload);

      return res.json({
        received: true,
        processed: true,
        profileId: result.profile.id,
        rank: result.profile.rank
      });
    }

    await db.recordWebhookEvent(eventId, verification.event || 'IGNORED_WEBHOOK', verification.orderId, verification.providerPaymentId, verification.rawPayload);
    return res.json({ received: true, processed: false, reason: 'Event acknowledged, no rank update required.' });
  };

  app.post('/api/payment/webhook', asyncHandler(async (req: Request, res: Response) => handleWebhook(req, res)));
  app.post('/api/payment/webhook/dodo', asyncHandler(async (req: Request, res: Response) => handleWebhook(req, res, 'dodo')));
  app.post('/api/payment/webhook/razorpay', asyncHandler(async (req: Request, res: Response) => handleWebhook(req, res, 'razorpay')));
  app.post('/api/payment/webhook/cashfree', asyncHandler(async (req: Request, res: Response) => handleWebhook(req, res, 'cashfree')));

  // Admin-authorized refund endpoint
  app.post('/api/payment/refund', asyncHandler(async (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 10, 60000)) {
      return res.status(429).json({ error: 'Too many refund requests.' });
    }
    const adminKey = req.headers['x-admin-key'] as string | undefined;
    if (!verifyAdminKey(adminKey)) {
      return res.status(403).json({ error: 'Unauthorized: Admin authentication required.' });
    }
    const { orderId, amount, reason } = req.body;
    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'orderId is required.' });
    }

    const merchantRefundId = (req.body.refundId && typeof req.body.refundId === 'string' ? req.body.refundId.trim() : '') ||
      ('ref_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12));

    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && process.env.ALLOW_MOCK_REFUNDS === 'true') {
      return res.status(500).json({
        error: 'FATAL CONFIGURATION ERROR: ALLOW_MOCK_REFUNDS cannot be enabled in production environment.',
        orderId,
        refundId: merchantRefundId
      });
    }

    const dbUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
    const isTestMode = !isProduction &&
      (process.env.NODE_ENV === 'test' || process.env.ALLOW_MOCK_REFUNDS === 'true') &&
      Boolean(dbUrl) &&
      isSafeLocalTestDatabase(dbUrl);

    const order = await db.getOrderAsync(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.', orderId, refundId: merchantRefundId });
    }

    // When provider refund capability is disabled/unconfigured, return clear 503 without reserving or reversing anything
    if (!paymentManager.mayInitiateAuthorizedRefund(order) && !isTestMode) {
      return res.status(503).json({
        error: 'Payment gateway provider is not enabled or unconfigured. Live refund processing unavailable.',
        orderId,
        refundId: merchantRefundId
      });
    }

    const amountINR: number = amount === undefined ? order.amount : Number(amount);
    if (!Number.isFinite(amountINR) || amountINR <= 0 ||
        Math.abs(amountINR * 100 - Math.round(amountINR * 100)) >= 1e-8) {
      return res.status(400).json({ error: 'Invalid refund amount.', orderId, refundId: merchantRefundId });
    }
    const refundPaise: number = Math.round(amountINR * 100);

    const refundReason = (reason && typeof reason === 'string') ? reason : 'Customer refund request';

    // Preflight reservation: reserve remaining refundable amount under FOR UPDATE BEFORE calling payment gateway
    const reservation = await db.reserveRefundAtomic(orderId, refundPaise, merchantRefundId, refundReason);
    if (!reservation.success) {
      return res.status(reservation.statusCode || 400).json({
        success: false,
        error: reservation.message || 'Refund reservation failed.',
        orderId,
        refundId: merchantRefundId,
        outcome: reservation.outcome
      });
    }

    // A1: Never issue a second createRefund call for EXISTING_PENDING or EXISTING_SUCCESS
    if (reservation.outcome === 'EXISTING_SUCCESS') {
      return res.json({
        success: true,
        outcome: 'EXISTING_SUCCESS',
        status: 'REFUNDED',
        orderId,
        refundId: merchantRefundId,
        amount: reservation.amount,
        message: reservation.message || 'Refund already settled.'
      });
    }

    if (reservation.outcome === 'EXISTING_PENDING') {
      return res.json({
        success: true,
        outcome: 'EXISTING_PENDING',
        status: 'REFUND_PENDING',
        orderId,
        refundId: merchantRefundId,
        amount: reservation.amount,
        message: 'Refund is currently pending provider confirmation; reconciliation worker will confirm status.'
      });
    }

    if (paymentManager.mayInitiateAuthorizedRefund(order) && !isTestMode) {
      try {
        const refundProvider = paymentManager.getProviderFor(order.provider);
        const providerRes = await refundProvider.createRefund({
          orderId,
          refundId: merchantRefundId,
          amount: amountINR,
          reason: refundReason
        });

        if (providerRes.status === 'UNKNOWN') {
          return res.status(504).json({
            success: false,
            status: 'REFUND_PENDING',
            orderId,
            refundId: merchantRefundId,
            uncertain: true,
            message: 'Gateway response timed out or returned unknown status. Refund reservation retained for reconciliation.'
          });
        }

        if (providerRes.status === 'FAILED') {
          // Terminal failure: release reservation
          await db.failRefundReservation(merchantRefundId, orderId);
          return res.status(400).json({
            success: false,
            status: 'FAILED',
            orderId,
            refundId: merchantRefundId,
            error: providerRes.error || 'Payment gateway rejected refund request.'
          });
        }

        if (providerRes.status === 'PENDING') {
          return res.json({
            success: true,
            status: 'REFUND_PENDING',
            orderId,
            refundId: merchantRefundId,
            amount: amountINR,
            message: 'Refund initiated with payment provider and is currently pending confirmation.'
          });
        }

        if (providerRes.status === 'SUCCESS') {
          let providerRefundId = (providerRes.raw?.refund_id || providerRes.raw?.cf_refund_id)
            ? String(providerRes.raw.refund_id || providerRes.raw.cf_refund_id)
            : merchantRefundId;
          const providerCurrency = providerRes.raw?.refund_currency || providerRes.raw?.currency;
          if (providerCurrency !== undefined && providerCurrency !== 'INR') {
            return res.status(400).json({
              error: 'Refund provider returned non-INR currency.',
              orderId,
              refundId: merchantRefundId
            });
          }

          // Authoritative server-to-server check before reversing
          try {
            const authStatus = await refundProvider.getRefundStatus(orderId, merchantRefundId);
            if (
              authStatus.status === 'SUCCESS' &&
              authStatus.orderId === orderId &&
              authStatus.merchantRefundId === merchantRefundId &&
              authStatus.currency === 'INR' &&
              toSafePaise(authStatus.amount) === toSafePaise(amountINR)
            ) {
              providerRefundId = authStatus.providerRefundId || providerRefundId;
              const reversed = await db.reverseRefund(orderId, amountINR, refundReason, merchantRefundId, providerRefundId, 'INR');
              if (!reversed) {
                return res.status(500).json({
                  error: 'Refund succeeded at gateway but database reconciliation is pending.',
                  orderId,
                  refundId: merchantRefundId,
                  status: 'RECONCILIATION_PENDING'
                });
              }
              const updatedOrder = await db.getOrderAsync(orderId);
              return res.json({
                success: true,
                status: updatedOrder?.status || 'REFUNDED',
                orderId,
                refundId: merchantRefundId,
                amount: amountINR
              });
            } else {
              return res.json({
                success: true,
                status: 'REFUND_PENDING',
                orderId,
                refundId: merchantRefundId,
                amount: amountINR,
                message: 'Refund submitted to gateway and is awaiting final settlement confirmation.'
              });
            }
          } catch (authErr: any) {
            console.warn('[Refund] Server-to-server verification check deferred: %s', sanitizeLog(authErr?.message));
            return res.json({
              success: true,
              status: 'REFUND_PENDING',
              orderId,
              refundId: merchantRefundId,
              amount: amountINR,
              message: 'Refund submitted to gateway; reconciliation worker will confirm status.'
            });
          }
        }
      } catch (err: any) {
        console.warn('[Refund] Provider refund error: %s', sanitizeLog(err?.message));
        // A2: Keep ambiguous provider outcomes reserved as PENDING for authoritative GET reconciliation; do NOT release
        return res.status(502).json({
          success: false,
          status: 'REFUND_PENDING',
          orderId,
          refundId: merchantRefundId,
          error: err?.message || 'Payment gateway communication failure during refund.'
        });
      }
    }

    // Retain local/mock refund behavior only in an explicit non-production test environment with safe test database
    if (isTestMode) {
      const reversed = await db.reverseRefund(orderId, amountINR, refundReason, merchantRefundId, undefined, 'INR');
      const updatedOrder = await db.getOrderAsync(orderId);
      return res.json({
        success: reversed,
        orderId,
        refundId: merchantRefundId,
        amount: amountINR,
        status: updatedOrder?.status || 'REFUNDED'
      });
    }

    return res.status(503).json({
      error: 'Live refund processing unavailable.',
      orderId,
      refundId: merchantRefundId
    });
  }));

  // Admin-authorized chargeback adjustment endpoint (Phase B3)
  app.post('/api/payment/chargeback', asyncHandler(async (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 10, 60000)) {
      return res.status(429).json({ error: 'Too many chargeback requests.' });
    }
    const adminKey = req.headers['x-admin-key'] as string | undefined;
    if (!verifyAdminKey(adminKey)) {
      return res.status(403).json({ error: 'Unauthorized: Admin authentication required.' });
    }
    const { orderId, disputeId, amount, reason, evidenceRef } = req.body;
    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'orderId is required.' });
    }
    if (!disputeId || typeof disputeId !== 'string') {
      return res.status(400).json({ error: 'disputeId is required.' });
    }
    if (!evidenceRef || typeof evidenceRef !== 'string') {
      return res.status(400).json({ error: 'evidenceRef is required.' });
    }
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Valid positive amount is required.' });
    }

    const result = await db.recordChargebackAtomic({
      orderId: orderId.trim(),
      disputeId: disputeId.trim(),
      amount: numAmount,
      reason: typeof reason === 'string' ? reason.trim() : undefined,
      evidenceRef: evidenceRef.trim()
    });

    if (!result.success) {
      return res.status(result.statusCode || 400).json(result);
    }

    const updatedOrder = await db.getOrderAsync(orderId.trim());
    return res.json({
      success: true,
      orderId: orderId.trim(),
      disputeId: disputeId.trim(),
      status: updatedOrder?.status || 'CHARGEBACK',
      message: result.message
    });
  }));

  // Challenge / Friend Nomination
  app.post('/api/challenge', asyncHandler(async (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 20, 60000)) {
      return res.status(429).json({ error: 'Too many challenges created. Please slow down.' });
    }

    const { nomineeName, reason, nominatorName, targetAmount, lazyReason } = req.body;

    if (!nomineeName || typeof nomineeName !== 'string' || nomineeName.trim().length === 0) {
      return res.status(400).json({ error: "Friend's name is required." });
    }

    if (nomineeName.trim().length > 30) {
      return res.status(400).json({ error: 'Name cannot exceed 30 characters.' });
    }

    if (containsProfanity(nomineeName) || (reason && containsProfanity(reason))) {
      return res.status(400).json({ error: 'Please keep challenge content respectful.' });
    }

    if (db.isPostgresAuthoritative()) {
      const nomination = await db.pg.createNominationChallenge({
        nomineeName: nomineeName.trim(),
        reason: reason || 'Too lazy to even defend themselves.',
        nominatorName: nominatorName?.trim(),
        targetAmount: targetAmount ? Number.parseInt(targetAmount, 10) : undefined,
        lazyReason: lazyReason?.trim()
      });
      return res.json({ success: true, nomination });
    }

    const nomination = db.createNominationChallenge(
      nomineeName,
      reason || 'Too lazy to even defend themselves.',
      nominatorName,
      targetAmount ? Number.parseInt(targetAmount, 10) : undefined,
      lazyReason
    );

    res.json({ success: true, nomination });
  }));

  // Customer email notification service is currently unavailable until verified outbound email delivery is provisioned.
  const handleNotificationSubscribe = (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 12, 60000)) {
      return res.status(429).json({ error: 'Too many notification requests. Please wait a moment before trying again.' });
    }
    return res.status(503).json({
      error: 'Customer email notification service is currently unavailable.'
    });
  };

  app.post('/api/notifications/subscribe', handleNotificationSubscribe);
  app.post('/api/notify-me', handleNotificationSubscribe);

  // Get single profile
  app.get('/api/profile/:id', asyncHandler(async (req: Request, res: Response) => {
    let profile: any = null;
    try {
      if (db.isPostgresAuthoritative()) {
        profile = await db.pg.getProfile(req.params.id);
      } else {
        profile = db.getProfile(req.params.id);
      }
    } catch (err: any) {
      console.error('[Profile API] Database query error:', err);
      return res.status(503).json({ error: 'Database service temporarily unavailable.' });
    }
    if (!profile) {
      // Owner-authenticated historical profile lookup (for zero-net / refunded profiles)
      const providedToken = (req.headers['x-profile-token'] as string | undefined)?.trim();
      if (providedToken) {
        let rawProfile: any = null;
        try {
          if (db.isPostgresAuthoritative()) {
            rawProfile = await db.pg.getRawProfile(req.params.id);
          } else {
            rawProfile = db.getRawProfile(req.params.id);
          }
        } catch (rawErr: any) {
          console.error('[Profile API] Database query error for raw profile:', rawErr);
          return res.status(503).json({ error: 'Database service temporarily unavailable.' });
        }
        if (rawProfile && verifyOwnerToken(rawProfile.ownerTokenHash || rawProfile.ownerToken, providedToken)) {
          // Strictly sanitize and neutralize: never expose owner tokens/hashes, never show rank 999999 as active, never show verified
          const sanitized = db.sanitizeProfile(rawProfile);
          sanitized.rank = 0;
          sanitized.isVerified = false;
          return res.json({ profile: sanitized, isHistorical: true });
        }
      }
      return res.status(404).json({ error: 'Profile not found.' });
    }
    res.json({ profile });
  }));

  // Update profile's selected Lazy Reason
  app.post('/api/profile/lazy-reason', asyncHandler(async (req: Request, res: Response) => {
    const { profileId, lazyReason } = req.body;
    const providedToken = (req.headers['x-profile-token'] as string) || req.body?.ownerToken;

    if (!profileId || typeof profileId !== 'string') {
      return res.status(400).json({ error: 'Valid profileId is required.' });
    }

    if (!lazyReason || typeof lazyReason !== 'string' || lazyReason.trim().length === 0) {
      return res.status(400).json({ error: 'Lazy reason is required.' });
    }

    if (!providedToken || typeof providedToken !== 'string' || providedToken.trim().length === 0) {
      return res.status(401).json({ error: 'Unauthorized: Owner token is required.' });
    }

    try {
      if (db.isPostgresAuthoritative()) {
        const updated = await db.pg.setProfileLazyReason(profileId, lazyReason.trim(), providedToken);
        if (!updated) {
          return res.status(404).json({ error: 'Profile not found.' });
        }
        return res.json({ success: true, profile: db.sanitizeProfile(updated) });
      }
      const updated = db.setProfileLazyReason(profileId, lazyReason.trim(), providedToken);
      if (!updated) {
        return res.status(404).json({ error: 'Profile not found.' });
      }
      res.json({ success: true, profile: updated });
    } catch (err: any) {
      return res.status(403).json({ error: err.message || 'Unauthorized: Token mismatch.' });
    }
  }));

  // AI Lazy Roast Generation (Server-side Gemini, cached for permanent sharing)
  app.post('/api/roast', asyncHandler(async (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 25, 60000)) {
      return res.status(429).json({ error: 'Too many roast requests. Please wait a moment.' });
    }

    const { profileId, forceRegenerate } = req.body;
    if (!profileId || typeof profileId !== 'string') {
      return res.status(400).json({ error: 'Valid profile ID is required to generate a roast.' });
    }

    const profile = db.isPostgresAuthoritative() ? await db.pg.getRawProfile(profileId) : db.getRawProfile(profileId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    // Force regeneration requires ownership or admin authorization (Prevents arbitrary public users from regenerating someone else's roast)
    if (forceRegenerate) {
      const providedToken = (req.headers['x-profile-token'] as string) || req.body?.ownerToken;
      const authHeader = req.headers['authorization'];
      const bearerKey = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;
      const adminKey = (req.headers['x-admin-key'] as string) || bearerKey;
      const isAdmin = verifyAdminKey(adminKey);

      if ((!providedToken || typeof providedToken !== 'string' || providedToken.trim().length === 0) && !isAdmin) {
        return res.status(401).json({ error: 'Unauthorized: Owner token is required to force roast regeneration.' });
      }

      const ownerHash = (profile as any).ownerTokenHash || profile.ownerToken;
      const isOwner = providedToken ? verifyOwnerToken(ownerHash, providedToken) : false;

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Forbidden: Invalid owner token or unauthorized admin key.' });
      }
    }

    // Return cached roast if it exists and force regeneration is not requested
    if (profile.roast && !forceRegenerate) {
      return res.json({
        success: true,
        roast: profile.roast,
        source: 'cached',
        profile: db.sanitizeProfile(profile)
      });
    }

    try {
      const topProfile = db.getTopProfile();
      const { roast, source } = await generateRoast(profile, {
        previousTopName: topProfile?.name,
        forceRegenerate: !!forceRegenerate
      });

      if (db.isPostgresAuthoritative()) {
        const updated = await db.pg.updateProfileRoast(profileId, roast);
        return res.json({
          success: true,
          roast,
          source,
          profile: updated ? db.sanitizeProfile(updated) : undefined
        });
      }

      const updated = db.setProfileRoast(profileId, roast);
      res.json({
        success: true,
        roast,
        source,
        profile: updated
      });
    } catch (err: any) {
      console.warn('Roast generation error, using fallback:', err?.message || err);
      const fallbackRoast = generateFallbackRoast(profile);
      if (db.isPostgresAuthoritative()) {
        const updated = await db.pg.updateProfileRoast(profileId, fallbackRoast);
        return res.json({
          success: true,
          roast: fallbackRoast,
          source: 'fallback',
          profile: updated ? db.sanitizeProfile(updated) : undefined
        });
      }
      const updated = db.setProfileRoast(profileId, fallbackRoast);
      res.json({
        success: true,
        roast: fallbackRoast,
        source: 'fallback',
        profile: updated
      });
    }
  }));

  // Vote for laziness (+1 social appreciation)
  app.post('/api/vote', asyncHandler(async (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    const userAgent = req.headers['user-agent'] as string | undefined;
    if (!checkRateLimit(clientIp, 30, 60000)) {
      return res.status(429).json({ error: 'Voting rate limit reached. Please wait.' });
    }

    const { profileId } = req.body;
    if (!profileId || typeof profileId !== 'string' || profileId.trim().length === 0 || profileId.length > 64) {
      return res.status(400).json({ error: 'Valid profile ID is required.' });
    }

    if (db.isPostgresAuthoritative()) {
      const result = await db.pg.voteProfile(profileId.trim(), clientIp, userAgent);
      if (!result.success) {
        if (result.message === 'Profile not found') {
          return res.status(404).json({ error: 'Profile not found.' });
        }
        if (result.message === 'Voting feature is temporarily unavailable.') {
          return res.status(503).json({ error: result.message, code: 'VOTING_UNAVAILABLE' });
        }
        if (result.message === 'You already voted for this person!') {
          return res.status(409).json({ error: result.message, code: 'ALREADY_VOTED' });
        }
        return res.status(400).json({ error: result.message });
      }
      return res.json(result);
    }

    const prof = db.getProfile(profileId.trim());
    if (!prof) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    const result = db.voteLazy(profileId.trim(), clientIp);
    res.json(result);
  }));

  // Report content (Strict target existence validation and character limits)
  app.post('/api/report', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientIp = getClientIp(req);
      const isRateLimited = db.isPostgresAuthoritative()
        ? !(await db.pg.checkRateLimit(`report:${clientIp}`, 40, 60000))
        : !checkRateLimit(clientIp, 40, 60000);

      if (isRateLimited) {
        return res.status(429).json({ error: 'Too many reports submitted. Please wait.' });
      }

      const { targetType, targetId, reason, details } = req.body;
      const validTypes = ['profile', 'nomination', 'comment'];
      const effectiveType = (targetType || 'profile').toLowerCase();
      if (!validTypes.includes(effectiveType)) {
        return res.status(400).json({ error: 'Invalid target type. Must be profile, nomination, or comment.' });
      }

      if (!targetId || typeof targetId !== 'string' || targetId.trim().length === 0 || targetId.trim().length > 64) {
        return res.status(400).json({ error: 'Valid target ID is required.' });
      }

      if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        return res.status(400).json({ error: 'Reason is required.' });
      }

      if (reason.trim().length > 100) {
        return res.status(400).json({ error: 'Reason cannot exceed 100 characters.' });
      }

      if (details && typeof details === 'string' && details.trim().length > 1000) {
        return res.status(400).json({ error: 'Details cannot exceed 1000 characters.' });
      }

      const cleanTargetId = targetId.trim();

      if (db.isPostgresAuthoritative()) {
        try {
          const report = await db.pg.createReport({
            targetType: effectiveType as 'profile' | 'comment' | 'nomination',
            targetId: cleanTargetId,
            reason: reason.trim(),
            details: typeof details === 'string' ? details.trim() : undefined,
            clientIp
          });
          return res.status(201).json({ success: true, message: 'Report submitted for review.', reportId: report.id });
        } catch (err: any) {
          if (err.message && err.message.includes('does not exist')) {
            return res.status(404).json({ error: err.message });
          }
          console.error('[PostgreSQL] createReport error:', err);
          return res.status(503).json({ error: 'Database temporarily unavailable for moderation reporting.' });
        }
      }

      if (effectiveType === 'profile') {
        const target = db.getRawProfile(cleanTargetId);
        if (!target) {
          return res.status(404).json({ error: 'Reported profile does not exist.' });
        }
      } else if (effectiveType === 'nomination') {
        const target = db.getNomination(cleanTargetId);
        if (!target) {
          return res.status(404).json({ error: 'Reported challenge does not exist.' });
        }
      }

      db.reportContent(effectiveType as 'profile' | 'nomination', cleanTargetId, reason.trim());
      return res.json({ success: true, message: 'Report submitted for review.' });
    } catch (error: unknown) {
      return next(error);
    }
  });

  // Contact inquiry / support ticket submission
  app.post('/api/contact', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientIp = getClientIp(req);
      const isRateLimited = db.isPostgresAuthoritative()
        ? !(await db.pg.checkRateLimit(`contact:${clientIp}`, 6, 60000))
        : !checkRateLimit(clientIp, 6, 60000);

      if (isRateLimited) {
        return res.status(429).json({
          error: `Too many messages sent. Please wait a minute or email ${SERVER_LEGAL_CONFIG.SUPPORT_EMAIL} directly.`
        });
      }

      let input: ContactInput;
      try {
        input = validateContact(req.body);
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Invalid contact request.' });
      }

      let inquiryId: string;
      if (db.isPostgresAuthoritative()) {
        try {
          const saved = await db.pg.createContactInquiry(input, clientIp);
          inquiryId = saved.id;
        } catch (dbErr: any) {
          console.error('[PostgreSQL] Failed to record contact inquiry:', dbErr);
          return res.status(503).json({
            error: `Support desk database temporarily unavailable. Please email ${SERVER_LEGAL_CONFIG.SUPPORT_EMAIL} directly.`
          });
        }
      } else {
        const saved = db.submitContact({
          name: input.name,
          email: input.email,
          subject: input.subject,
          orderId: input.orderId,
          message: input.message,
          ip: clientIp
        });
        inquiryId = saved.id;
      }

      return res.status(201).json({
        success: true,
        message: `Inquiry received successfully. Our support desk (${SERVER_LEGAL_CONFIG.SUPPORT_EMAIL}) reviews inquiries during published business hours and aims to respond as soon as reasonably possible.`,
        inquiryId
      });
    } catch (error: unknown) {
      return next(error);
    }
  });

  // Activity feed
  app.get('/api/activity', (req: Request, res: Response) => {
    const activities = db.getActivities();
    res.json({ activities });
  });

  // Global Activity and Claims Heat Map metrics (Authoritative real-time social proof)
  app.get('/api/activity/global', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (db.isPostgresAuthoritative()) {
        const data = await db.pg.getGlobalActivity();
        return res.json(data);
      }
      const data = db.getGlobalActivity();
      return res.json(data);
    } catch (error: unknown) {
      return next(error);
    }
  });

  // Weekly Lazy Dilemma Poll endpoints (Server-controlled voter identity derived from client IP)
  app.get('/api/dilemma', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const voterKey = crypto
      .createHash('sha256')
      .update(`${ip}:${process.env.VOTER_SALT || 'lazy-poll-voter-salt'}`)
      .digest('hex')
      .slice(0, 32);
    const dilemma = db.getDilemma(voterKey);
    res.json(dilemma);
  });

  app.post('/api/dilemma/vote', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip, 30, 60000)) {
      return res.status(429).json({ error: 'Too many voting attempts. Please wait.' });
    }

    const { optionId } = req.body;
    if (!optionId || typeof optionId !== 'string' || optionId.trim().length === 0) {
      return res.status(400).json({ error: 'Option ID is required.' });
    }

    // Server-controlled anonymous voter key using SHA256 of client IP + salt
    const voterKey = crypto
      .createHash('sha256')
      .update(`${ip}:${process.env.VOTER_SALT || 'lazy-poll-voter-salt'}`)
      .digest('hex')
      .slice(0, 32);

    const result = db.voteDilemma(optionId.trim(), voterKey);

    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  // Non-sensitive UI analytics tracking with strict allowlist
  const ALLOWED_ANALYTICS_EVENTS = new Set([
    'homepageViews',
    'claimStarts',
    'amountSelected',
    'checkoutStarts',
    'shareClicks',
    'leaderboardClicks',
    'instagramClicks',
    'websiteClicks',
    'challengeClicks'
  ]);

  app.post('/api/analytics/track', (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 60, 60000)) {
      return res.status(429).json({ error: 'Rate limit exceeded.' });
    }
    const { event } = req.body;
    if (!event || typeof event !== 'string' || !ALLOWED_ANALYTICS_EVENTS.has(event)) {
      return res.status(400).json({ error: 'Invalid or disallowed analytics event.' });
    }
    db.trackEvent(event as any);
    res.json({ ok: true });
  });

  // Protected admin data endpoint (Header-only authentication, constant-time check, no-store)
  app.get('/api/admin/data', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientIp = getClientIp(req);
      if (!checkRateLimit(clientIp, 20, 60000)) {
        return res.status(429).json({ error: 'Too many admin requests.' });
      }
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

      const authHeader = req.headers['authorization'];
      const bearerKey = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;
      const adminKey = (req.headers['x-admin-key'] as string) || bearerKey;

      if (!verifyAdminKey(adminKey)) {
        return res.status(401).json({ error: 'Unauthorized admin access.' });
      }

      if (db.isPostgresAuthoritative()) {
        const limit = Math.min(Number.parseInt(req.query.limit as string, 10) || 50, 100);
        const offset = Math.max(Number.parseInt(req.query.offset as string, 10) || 0, 0);
        const data = await db.pg.getAdminData(limit, offset);
        return res.json(data);
      }

      return res.json(db.getAdminData());
    } catch (error: unknown) {
      return next(error);
    }
  });

  // Protected admin action endpoint (Header-only authentication, constant-time check, no-store)
  app.post('/api/admin/moderate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientIp = getClientIp(req);
      if (!checkRateLimit(clientIp, 30, 60000)) {
        return res.status(429).json({ error: 'Too many admin requests.' });
      }
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

      const authHeader = req.headers['authorization'];
      const bearerKey = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;
      const adminKey = (req.headers['x-admin-key'] as string) || bearerKey;

      if (!verifyAdminKey(adminKey)) {
        return res.status(401).json({ error: 'Unauthorized admin access.' });
      }

      const { action, targetId } = req.body;
      const validActions = ['remove', 'restore', 'resolve_report'];
      if (!action || typeof action !== 'string' || !validActions.includes(action)) {
        return res.status(400).json({ error: 'Invalid moderation action. Must be remove, restore, or resolve_report.' });
      }
      if (!targetId || typeof targetId !== 'string' || targetId.trim().length === 0) {
        return res.status(400).json({ error: 'Valid target ID is required.' });
      }

      const cleanTargetId = targetId.trim();

      if (db.isPostgresAuthoritative()) {
        if (action === 'resolve_report') {
          const ok = await db.pg.resolveReport(cleanTargetId);
          if (!ok) {
            return res.status(404).json({ error: 'Report not found or already resolved.' });
          }
          return res.json({ success: true, message: 'Report resolved successfully.' });
        } else if (action === 'remove' || action === 'restore') {
          const ok = await db.pg.moderateProfile(cleanTargetId, action);
          if (!ok) {
            return res.status(404).json({ error: 'Target profile not found or action could not be applied.' });
          }
          return res.json({ success: true, message: `Action ${action} applied successfully.` });
        }
      }

      const success = db.moderate(action as any, cleanTargetId);
      if (!success) {
        return res.status(404).json({ error: 'Target not found or action could not be applied.' });
      }
      return res.json({ success: true, message: `Action ${action} applied successfully.` });
    } catch (error: unknown) {
      return next(error);
    }
  });

  // In-memory cache for rendered OG card PNG buffers (LRU-capped)
  const ogPngCache = new Map<string, { buffer: Buffer; timestamp: number }>();

  // Dynamic Open Graph Card generator (PNG and SVG) for social platforms & search engines
  app.get('/api/og/card/:id', asyncHandler(async (req: Request, res: Response) => {
    let profileId = req.params.id || '';
    let format = 'png'; // Default to PNG for crawler compatibility (Twitter, WhatsApp, Facebook, LinkedIn)

    if (profileId.endsWith('.png')) {
      profileId = profileId.slice(0, -4);
      format = 'png';
    } else if (profileId.endsWith('.svg')) {
      profileId = profileId.slice(0, -4);
      format = 'svg';
    } else if (req.query.format === 'svg') {
      format = 'svg';
    }

    let profile: any = null;
    try {
      profile = db.isPostgresAuthoritative() ? await db.pg.getProfile(profileId) : db.getProfile(profileId);
    } catch (ogDbErr: any) {
      console.error('[OG Card API] Database query error:', ogDbErr);
      return res.status(503).send('Database unavailable');
    }
    if (!profile) {
      return res.status(404).send('Profile not found');
    }

    const svg = generateProfileOgSvg(profile);

    if (format === 'svg') {
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      return res.send(svg);
    }

    // Render high-fidelity PNG with Sharp
    try {
      const cacheKey = `${profile.id}-${profile.amount}-${profile.rank}-${profile.updatedAt || profile.createdAt}`;
      const cached = ogPngCache.get(cacheKey);
      if (cached) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
        return res.send(cached.buffer);
      }

      const pngBuffer = await sharp(Buffer.from(svg)).png({ quality: 92 }).toBuffer();

      // Prune cache if oversized
      if (ogPngCache.size > 200) {
        const firstKey = ogPngCache.keys().next().value;
        if (firstKey) ogPngCache.delete(firstKey);
      }
      ogPngCache.set(cacheKey, { buffer: pngBuffer, timestamp: Date.now() });

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      return res.send(pngBuffer);
    } catch (renderErr) {
      console.error('Error rendering PNG card with Sharp, falling back to SVG:', renderErr);
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      return res.send(svg);
    }
  }));

  // Dynamic Public-Profile XML Sitemap
  app.get('/sitemap-profiles.xml', asyncHandler(async (_req: Request, res: Response) => {
    try {
      let profiles: Array<{ id: string; updated_at?: string; created_at?: string }> = [];
      if (db.isPostgresAuthoritative()) {
        const pool = await db.pg.getPool();
        const result = await pool.query(
          `SELECT id, updated_at, created_at FROM profiles\n` +
          `WHERE moderation_status = 'active' AND is_verified = TRUE AND amount > 0\n` +
          `ORDER BY amount DESC, first_verified_at ASC NULLS LAST, id ASC\n` +
          `LIMIT 50000`
        );
        profiles = result.rows;
      } else {
        const leaderboard = db.getLeaderboard({ limit: 50000, filter: 'verified', period: 'all' });
        profiles = (leaderboard?.profiles || [])
          .filter(p => p.isVerified && p.amount > 0 && p.moderationStatus === 'active')
          .map(p => ({
            id: p.id,
            updated_at: p.updatedAt,
            created_at: p.createdAt
          }));
      }

      const configuredAppUrl = process.env.APP_URL?.trim() ? stripTrailingSlash(process.env.APP_URL.trim()) : undefined;
      const defaultOrigin = process.env.NODE_ENV === 'production' ? 'https://lazyproof.online' : `http://localhost:${process.env.PORT || 3000}`;
      const baseUrl = configuredAppUrl || defaultOrigin;

      const escapeXml = (unsafe: string) =>
        unsafe
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');

      const urls = profiles
        .map(p => {
          const loc = `${baseUrl}/profile/${encodeURIComponent(p.id)}`;
          const rawDate = p.updated_at || p.created_at;
          let lastmod = '';
          if (rawDate) {
            try {
              const d = new Date(rawDate);
              if (!Number.isNaN(d.getTime())) {
                lastmod = d.toISOString().split('T')[0];
              }
            } catch {}
          }
          if (!lastmod) {
            lastmod = '2026-09-28';
          }
          return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.7</priority>\n  </url>`;
        })
        .join('\n');

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      return res.send(xml);
    } catch (sitemapErr) {
      console.error('Error generating sitemap-profiles.xml:', sitemapErr);
      res.status(500).type('text/plain').send('Error generating sitemap');
    }
  }));

  // 404 Catch-all for unhandled API endpoints
  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Helper to handle dynamic profile and route HTML metadata & JSON-LD injection
  const handlePageRequest = async (
    req: Request,
    res: Response,
    next: () => void,
    isProd: boolean,
    distPath?: string,
    viteInstance?: any
  ) => {
    try {
      // Pass through API endpoints, asset files, and Vite internal requests
      if (
        req.path.startsWith('/api/') ||
        req.path.startsWith('/@') ||
        req.path.startsWith('/src/') ||
        req.path.startsWith('/node_modules/') ||
        /\.[a-zA-Z0-9]+$/.test(req.path) // e.g. .svg, .png, .js, .css, .json, .ico
      ) {
        return next();
      }

      const configuredAppUrl = process.env.APP_URL?.trim() ? stripTrailingSlash(process.env.APP_URL.trim()) : undefined;
      const defaultOrigin = process.env.NODE_ENV === 'production' ? 'https://lazyproof.online' : `http://localhost:${process.env.PORT || 3000}`;
      const baseUrl = configuredAppUrl || defaultOrigin;
      let rankId = (req.query.rank as string) || (req.query.profile as string);
      const isProfilePath = req.path.startsWith('/profile/') || req.path === '/profile';
      if (!rankId && req.path.startsWith('/profile/')) {
        rankId = stripTrailingSlash(req.path.replace(/^\/profile\//, '')).trim();
      }

      // 1. Dynamic Profile Page (/?rank=:id or /profile/:id)
      if (rankId || isProfilePath) {
        if (!rankId) {
          return res.status(404).type('text/plain').send('Profile not found');
        }

        let profile = null;
        try {
          profile = db.isPostgresAuthoritative() ? await db.pg.getProfile(rankId) : db.getProfile(rankId);
        } catch (_err) {
          profile = null;
        }

        if (profile) {
          let template: string;
          if (!isProd && viteInstance) {
            const rawTemplate = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
            template = await viteInstance.transformIndexHtml(req.originalUrl, rawTemplate);
          } else {
            template = fs.readFileSync(path.join(distPath || path.join(process.cwd(), 'dist'), 'index.html'), 'utf-8');
          }

          const transformedHtml = injectProfileMetadata(template, profile, baseUrl);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.send(transformedHtml);
        } else if (isProfilePath) {
          return res.status(404).type('text/plain').send('Profile not found');
        }
      }

      // 2. Specific Named Routes (/, /about, /rules, /terms, /privacy, /refund-cancellation, /refund, /contact)
      const cleanPath = stripTrailingSlash(req.path) || '/';
      if (ROUTE_SEO[cleanPath] || cleanPath === '/') {
        let template: string;
        if (!isProd && viteInstance) {
          const rawTemplate = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
          template = await viteInstance.transformIndexHtml(req.originalUrl, rawTemplate);
        } else {
          template = fs.readFileSync(path.join(distPath || path.join(process.cwd(), 'dist'), 'index.html'), 'utf-8');
        }

        const prerenderContent = prerenderRoute(cleanPath);
        if (prerenderContent) {
          template = template.replace('<div id="root"></div>', `<div id="root">${prerenderContent}</div>`);
        }

        const transformedHtml = injectRouteMetadata(template, cleanPath, baseUrl);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(transformedHtml);
      }

      return next();
    } catch (err) {
      console.error('Error rendering dynamic route or profile metadata:', err);
      return next();
    }
  };

  const staticPagePaths: ReadonlySet<string> = new Set([
    '/', '/terms', '/privacy', '/refund-cancellation',
    '/delivery', '/contact', '/about', '/rules', '/refund', '/pricing'
  ]);

  const isKnownSpaPath = (pathname: string): boolean => {
    const clean = stripTrailingSlash(pathname) || '/';
    if (staticPagePaths.has(clean)) return true;
    if (clean === '/profile' || clean.startsWith('/profile/')) return true;
    return false;
  };

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    // Intercept page visits before Vite SPA fallback to serve unique server-injected metadata & JSON-LD
    app.use(async (req: Request, res: Response, next: NextFunction) => {
      if (req.method === 'GET') {
        const hasExtension = path.extname(req.path) !== '';
        if (hasExtension) {
          return next();
        }
        if (!isKnownSpaPath(req.path)) {
          return res.status(404).type('text/plain').send('Not found');
        }
        return handlePageRequest(req, res, next, false, undefined, vite);
      }
      next();
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { fallthrough: true }));

    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (!isKnownSpaPath(req.path)) {
        return res.status(404).type('text/plain').send('Not found');
      }
      return handlePageRequest(req, res, () => {
        res.sendFile(path.join(distPath, 'index.html'));
      }, true, distPath);
    });
  }

  // Global error handler - placed AFTER all routes and middleware
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    console.error('Server error:', err?.message || err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'Internal server error.' });
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`LAZY v2.0 server running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: any) => {
    console.error('[Server Listen Error]', err);
    process.exit(1);
  });

  // --------------------------------------------------------------------------
  // Adaptive Idle-Efficient Workers (Phase C Resilience)
  // Eliminates unconditional database polling to preserve serverless PostgreSQL compute allowance.
  // When idle, workers sleep for 15 minutes instead of waking the database every 15s/60s.
  // Immediate wakeups are triggered on events (payment settlements, outbox enqueues, order creations).
  // --------------------------------------------------------------------------
  const IDLE_WORKER_DELAY_MS = 15 * 60 * 1000; // 15 minutes when idle
  const ACTIVE_OUTBOX_DELAY_MS = 15 * 1000;    // 15 seconds when active backlog exists
  const ACTIVE_RECON_DELAY_MS = 60 * 1000;     // 60 seconds when active backlog exists

  let isShuttingDown = false;
  let outboxTimeout: NodeJS.Timeout | null = null;
  let isOutboxRunning = false;
  let hasPendingOutboxWork = false;

  const runOutboxPass = async () => {
    if (isOutboxRunning || isShuttingDown) return;
    if (!db.isPostgresAuthoritative()) return;
    isOutboxRunning = true;
    try {
      const result = await db.pg.dispatchOperationalOutbox();
      // If work was processed or failures occurred, schedule active retry; otherwise sleep idle
      hasPendingOutboxWork = result.processed > 0 || result.failed > 0;
    } catch (err) {
      console.error('[Outbox Worker] Dispatch pass error:', err);
      hasPendingOutboxWork = false;
    } finally {
      isOutboxRunning = false;
      const nextDelay = hasPendingOutboxWork ? ACTIVE_OUTBOX_DELAY_MS : IDLE_WORKER_DELAY_MS;
      if (!isShuttingDown) {
        outboxTimeout = setTimeout(runOutboxPass, nextDelay);
        outboxTimeout.unref();
      }
    }
  };

  const triggerOutboxDispatch = (): void => {
    hasPendingOutboxWork = true;
    if (outboxTimeout) {
      clearTimeout(outboxTimeout);
      outboxTimeout = null;
    }
    if (!isOutboxRunning && !isShuttingDown) {
      setImmediate(runOutboxPass);
    }
  };

  // Wire outbox event trigger from database layer
  db.pg.setOnOutboxEnqueued(triggerOutboxDispatch);

  let reconciliationTimeout: NodeJS.Timeout | null = null;
  let isReconciliationRunning = false;
  let hasPendingReconWork = false;

  const runReconciliationPass = async () => {
    if (isReconciliationRunning || isShuttingDown) return;
    if (!db.isPostgresAuthoritative()) return;
    isReconciliationRunning = true;
    try {
      const result = await db.pg.reconcilePendingTransactions(paymentManager);
      hasPendingReconWork = result.reconciledOrders > 0 || result.reconciledRefunds > 0;
    } catch (err) {
      console.error('[Reconciliation Worker] Scheduled pass failed:', err);
      hasPendingReconWork = false;
    } finally {
      isReconciliationRunning = false;
      const nextDelay = hasPendingReconWork ? ACTIVE_RECON_DELAY_MS : IDLE_WORKER_DELAY_MS;
      if (!isShuttingDown) {
        reconciliationTimeout = setTimeout(runReconciliationPass, nextDelay);
        reconciliationTimeout.unref();
      }
    }
  };

  const triggerReconciliation = (delayMs: number = 0): void => {
    hasPendingReconWork = true;
    if (reconciliationTimeout) {
      clearTimeout(reconciliationTimeout);
      reconciliationTimeout = null;
    }
    if (!isReconciliationRunning && !isShuttingDown) {
      if (delayMs <= 0) {
        setImmediate(runReconciliationPass);
      } else {
        reconciliationTimeout = setTimeout(runReconciliationPass, delayMs);
        reconciliationTimeout.unref();
      }
    }
  };

  // Run initial passes on startup to clear any unhandled backlog from previous runs
  if (db.isPostgresAuthoritative()) {
    runOutboxPass().catch(err => {
      console.error('[Outbox Worker] Startup dispatch error:', err);
    });
    runReconciliationPass().catch(err => {
      console.error('[Reconciliation Worker] Startup pass error:', err);
    });
  }

  const gracefulShutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[Lifecycle] Received ${signal}. Starting graceful shutdown...`);

    if (outboxTimeout) clearTimeout(outboxTimeout);
    if (reconciliationTimeout) clearTimeout(reconciliationTimeout);

    const forceExitTimeout = setTimeout(() => {
      console.warn('[Lifecycle] Forced shutdown deadline reached (10s). Terminating process.');
      process.exit(1);
    }, 10000);
    forceExitTimeout.unref();

    server.close(async (err) => {
      if (err) {
        console.error('[Lifecycle] Error closing HTTP server:', err);
      }
      try {
        // Await in-flight workers (up to 4s) to drain clean transactional state
        const drainDeadline = Date.now() + 4000;
        while ((isOutboxRunning || isReconciliationRunning) && Date.now() < drainDeadline) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        if (db.isPostgresAuthoritative()) {
          await db.pg.close();
          console.log('[Lifecycle] PostgreSQL pool closed cleanly.');
        }
      } catch (dbCloseErr) {
        console.error('[Lifecycle] Error closing PostgreSQL pool:', dbCloseErr);
      }
      clearTimeout(forceExitTimeout);
      console.log('[Lifecycle] Graceful shutdown completed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('[Server Startup Failure]', err);
  process.exit(1);
});

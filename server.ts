import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import sharp from 'sharp';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.ts';
import { generateRoast, generateFallbackRoast } from './server/roast.ts';
import { generateProfileOgSvg, injectProfileMetadata, injectRouteMetadata, ROUTE_SEO } from './server/seo.ts';
import { SERVER_LEGAL_CONFIG } from './server/config/legal.ts';
import { paymentManager } from './server/payments/index.ts';
import { prerenderRoute } from './server/prerender.tsx';
import { validateContact, ContactInput, hashToken, verifyOwnerToken, constantTimeMatch } from './server/db/postgres.ts';
import { toSafePaise } from './server/payments/provider.ts';

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

export const CURRENT_TERMS_VERSION = '2026-09-24';
export const CURRENT_PRIVACY_VERSION = '2026-09-24';

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

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const usePg = isProd || process.env.USE_POSTGRES === 'true';

  // Section 2A: Mandatory DATABASE_URL in production with fail-fast startup
  if (usePg) {
    if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.trim()) {
      throw new Error('FATAL CONFIGURATION ERROR: DATABASE_URL is mandatory in production environment. Silently falling back to local JSON is prohibited.');
    }
    const pgInitOk = await db.pg.init();
    if (!pgInitOk) {
      throw new Error('FATAL CONFIGURATION ERROR: Failed to connect to PostgreSQL and initialize schema.');
    }
    console.log('[PostgreSQL] Initialized as authoritative production database.');
  }

  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Disable server technology fingerprinting
  app.disable('x-powered-by');

  // Explicit trust proxy configuration to prevent X-Forwarded-For IP spoofing
  if (process.env.TRUST_PROXY) {
    const tp = process.env.TRUST_PROXY.trim();
    if (tp === 'true') {
      app.set('trust proxy', true);
    } else if (tp === 'false') {
      app.set('trust proxy', false);
    } else if (!isNaN(Number(tp))) {
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
      isProd ? "script-src 'self' https://sdk.cashfree.com" : "script-src 'self' 'unsafe-inline' https://sdk.cashfree.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob:",
      isProd ? "connect-src 'self' https://sandbox.cashfree.com https://api.cashfree.com" : "connect-src 'self' ws: wss: https: https://sandbox.cashfree.com https://api.cashfree.com",
      "frame-src 'self' https://sdk.cashfree.com",
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
    'c947a52'
  ).slice(0, 40);

  // Health check with safe public build SHA
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      product: 'LAZY',
      version: '2.0',
      storage: db.isPostgresAuthoritative() ? 'postgresql' : 'json',
      commitSha: buildSha
    });
  });

  // Leaderboard endpoint (Canonical source of paid ranks with server pagination & period filtering)
  app.get('/api/leaderboard', asyncHandler(async (req: Request, res: Response) => {
    const rawPeriod = (req.query.period as string) || 'all';
    if (rawPeriod !== 'all' && rawPeriod !== 'today') {
      return res.status(400).json({
        error: "Unsupported period parameter. Supported periods are 'all' and 'today'."
      });
    }
    const period = rawPeriod as 'all' | 'today';
    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined;
    const offset = req.query.offset !== undefined ? parseInt(req.query.offset as string, 10) : undefined;
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit as string, 10) : undefined;
    const filter = (req.query.filter as 'verified' | 'all') || 'verified';

    if (db.isPostgresAuthoritative()) {
      const data = await db.pg.getLeaderboard({ period, page, pageSize, offset, limit, filter });
      return res.json({
        ...data,
        timestamp: new Date().toISOString()
      });
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
  app.get('/api/rank/top', async (req: Request, res: Response) => {
    let topAmount = 0;
    if (db.isPostgresAuthoritative()) {
      topAmount = await db.pg.getTopAmount();
    } else {
      topAmount = db.getTopAmount();
    }
    const minAmountToBeatTop = topAmount + 1;
    res.json({
      topAmount,
      minAmountToBeatTop
    });
  });

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
  app.get('/api/payment/config', (req: Request, res: Response) => {
    const taxReady = isTaxReady();
    const taxDisclosure = getTaxDisclosure();
    res.json({
      paymentMode: paymentManager.getMode(),
      enabled: paymentManager.isEnabled() && taxReady,
      taxReady,
      taxDisclosure,
      provider: paymentManager.getProvider().name,
      isSandbox: paymentManager.getMode() === 'sandbox',
      legalBusinessName: SERVER_LEGAL_CONFIG.LEGAL_BUSINESS_NAME,
      brandName: SERVER_LEGAL_CONFIG.BRAND_NAME,
      serviceDescription: SERVER_LEGAL_CONFIG.SERVICE_DESCRIPTION,
      currency: 'INR',
      onboardingNotice: (paymentManager.isEnabled() && taxReady)
        ? null
        : 'Payments will be verified server-side when gateway processing is enabled.'
    });
  });

  // Create payment order / initiate claim
  app.post('/api/payment/create-order', asyncHandler(async (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 30, 60000)) {
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }

    // STRICT PAYMENT DISABLEMENT: When disabled or unconfigured or tax not ready
    if (!paymentManager.isEnabled()) {
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

    const {
      name, amount, instagram, linkedin, website, twitter, reason, lazyReason,
      profileId, customerEmail, customerPhone, consentAccepted,
      ownerToken: bodyOwnerToken, pendingOwnerToken, orderAccessToken
    } = req.body;
    const providedToken = (req.headers['x-profile-token'] as string) || bodyOwnerToken || pendingOwnerToken;
    const clientOrderAccessToken = (req.headers['x-order-access-token'] as string) || orderAccessToken;

    const num = Number(amount);
    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || !Number.isInteger(num) || parsedAmount < 1 || parsedAmount > 1000000) {
      return res.status(400).json({ error: 'Payment amount must be a whole integer between ₹1 and ₹10,00,000.' });
    }

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

    // Customer phone validation: required 10-digit Indian mobile number
    const phoneStr = (customerPhone && typeof customerPhone === 'string' ? customerPhone.trim() : '');
    if (!phoneStr || !/^[6-9]\d{9}$/.test(phoneStr)) {
      return res.status(400).json({ error: 'A valid 10-digit mobile number is required for checkout.' });
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
    const isTop = parsedAmount > topAmount;

    // Server-authoritative quote breakdown in minor integer paise
    const basePaise = parsedAmount * 100;
    const taxPaise = 0;
    const feePaise = 0;
    const totalPaise = basePaise + taxPaise + feePaise;
    const quoteSnapshot = {
      basePaise,
      taxPaise,
      feePaise,
      totalPaise,
      currency: 'INR',
      serviceDescription: 'Digital sponsored profile placement on LazyProof',
      taxBasis: isTaxReady()
        ? 'GST not charged: supplier verified unregistered under applicable registration rules'
        : 'GST status being verified — checkout unavailable',
      quoteVersion: CURRENT_TERMS_VERSION,
      timestamp: new Date().toISOString()
    };

    db.trackEvent('checkoutStarts');

    // Real retry-safe checkout idempotency
    const clientProvidedIdempotency = (req.headers['x-idempotency-key'] as string | undefined)?.trim() ||
      (req.body?.idempotencyKey as string | undefined)?.trim();
    const idempotencyKey = clientProvidedIdempotency || `idem_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    // If order with this idempotencyKey already exists, verify consistency and return directly
    const existingOrder = await db.getOrderByIdempotencyKey(idempotencyKey);
    if (existingOrder) {
      const isExistingTop = existingOrder.amount > topAmount;
      const amountMatch = Number(existingOrder.amount) === parsedAmount;
      const nameMatch = existingOrder.name === name.trim();
      const phoneMatch = !existingOrder.customerPhone || existingOrder.customerPhone === phoneStr;
      const profileMatch = (existingOrder.profileId || undefined) === (profileId || undefined);

      const ownerTokenMatch = existingOrder.ownerTokenHash
        ? (providedToken && verifyOwnerToken(existingOrder.ownerTokenHash, providedToken))
        : true;
      const accessTokenMatch = existingOrder.orderAccessTokenHash
        ? (clientOrderAccessToken && constantTimeMatch(existingOrder.orderAccessTokenHash, hashToken(clientOrderAccessToken)))
        : true;

      if (!amountMatch || !nameMatch || !phoneMatch || !profileMatch || !ownerTokenMatch || !accessTokenMatch) {
        return res.status(409).json({
          error: 'Idempotency conflict: order parameters differ for this idempotency key.'
        });
      }

      return res.json({
        orderId: existingOrder.orderId,
        paymentSessionId: existingOrder.paymentSessionId,
        checkoutUrl: existingOrder.checkoutUrl,
        providerOrderId: existingOrder.providerOrderId,
        idempotencyKey,
        name: existingOrder.name,
        amount: existingOrder.amount,
        currency: existingOrder.currency || 'INR',
        isTop: isExistingTop,
        topAmount,
        minAmountToBeatTop: topAmount + 1,
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

    // Authoritative server-side order registration
    await db.createOrder({
      orderId,
      name: name.trim(),
      amount: parsedAmount,
      currency: 'INR',
      profileId,
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
      consentVersion: CURRENT_TERMS_VERSION
    });

    try {
      const providerOrder = await paymentManager.getProvider().createOrder({
        orderId,
        amount: parsedAmount,
        currency: 'INR',
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
        idempotencyKey,
        name: name.trim(),
        amount: parsedAmount,
        currency: 'INR',
        isTop,
        topAmount,
        minAmountToBeatTop: topAmount + 1,
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
        error: err?.message || 'Payment gateway order creation failed.',
        orderId
      });
    }
  }));

  // Server-side Payment Verification (Authoritative: grants rank only upon verified order & payment)
  app.post('/api/payment/verify', (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 25, 60000)) {
      return res.status(429).json({ error: 'Too many verification attempts. Please slow down.' });
    }

    // STRICT PAYMENT DISABLEMENT
    if (!paymentManager.isEnabled()) {
      return res.status(503).json({
        error: 'Payments are currently unavailable until payment processing is enabled.',
        paymentMode: 'disabled'
      });
    }

    const { paymentReference, orderId, instagram, linkedin, website, reason, profileId } = req.body;

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'Order ID is required for payment verification.' });
    }

    const order = db.getOrder(orderId);
    if (!order) {
      return res.status(400).json({ error: 'Invalid or expired payment order ID.' });
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

    // Require valid x-order-access-token if order has an access token hash
    const orderAccessToken = (req.headers['x-order-access-token'] as string | undefined)?.trim();
    const profileToken = (req.headers['x-profile-token'] as string | undefined)?.trim();
    if (order.orderAccessTokenHash) {
      if (!orderAccessToken || !constantTimeMatch(order.orderAccessTokenHash, hashToken(orderAccessToken))) {
        return res.status(403).json({ error: 'Unauthorized: Valid order access token required.' });
      }
    } else {
      // Historical orders with NULL order_access_token_hash: require verifiable owner authentication
      const ownerHash = order.ownerTokenHash || order.ownerToken;
      if (ownerHash) {
        if (!profileToken || !verifyOwnerToken(ownerHash, profileToken)) {
          return res.status(403).json({ error: 'Unauthorized: Valid profile token required for historical order.' });
        }
      }
    }
    res.setHeader('Cache-Control', 'no-store');

    if (order.status === 'completed' || order.status === 'PAID') {
      const profile = order.profileId
        ? (db.isPostgresAuthoritative() ? await db.pg.getProfile(order.profileId) : db.getProfile(order.profileId))
        : undefined;
      return res.json({
        orderId,
        status: 'PAID',
        profile: profile ? db.sanitizeProfile(profile) : undefined
      });
    }

    if (paymentManager.isEnabled()) {
      try {
        const providerStatus = await paymentManager.getProvider().getPaymentStatus(orderId);
        if (providerStatus.status === 'PAID' && order.status !== 'completed' && order.status !== 'PAID') {
          const providerPaise = toSafePaise(providerStatus.amount);
          const orderPaise = toSafePaise(order.amount);
          if (!providerStatus.providerPaymentId || providerStatus.currency !== 'INR' || order.currency !== 'INR' ||
              providerPaise === null || orderPaise === null || providerPaise !== orderPaise) {
            return res.status(409).json({ error: 'Provider payment verification mismatch against registered order.' });
          }

          if (db.isPostgresAuthoritative()) {
            const settlement = await db.pg.settlePaymentAtomic({
              orderId,
              providerPaymentId: providerStatus.providerPaymentId.trim(),
              provider: 'cashfree',
              amount: providerPaise / 100,
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
              amount: providerPaise / 100,
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
      status: (order.status === 'completed' || order.status === 'PAID') ? 'PAID' : (order.status || 'PENDING')
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

    // Require valid x-order-access-token if order has an access token hash
    const orderAccessToken = (req.headers['x-order-access-token'] as string | undefined)?.trim();
    const profileToken = (req.headers['x-profile-token'] as string | undefined)?.trim();
    if (order.orderAccessTokenHash) {
      if (!orderAccessToken || !constantTimeMatch(order.orderAccessTokenHash, hashToken(orderAccessToken))) {
        return res.status(403).json({ error: 'Unauthorized: Valid order access token required.' });
      }
    } else {
      // Historical orders with NULL order_access_token_hash: require verifiable owner authentication
      const ownerHash = order.ownerTokenHash || order.ownerToken;
      if (ownerHash) {
        if (!profileToken || !verifyOwnerToken(ownerHash, profileToken)) {
          return res.status(403).json({ error: 'Unauthorized: Valid profile token required for historical order.' });
        }
      }
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

  // Authoritative Provider Webhook (Cashfree PG v2023-08-01 / v2026-01-01 + fallback)
  app.post('/api/payment/webhook', asyncHandler(async (req: Request, res: Response) => {
    if (!paymentManager.isEnabled()) {
      return res.status(503).json({ error: 'Payment processing is currently disabled.' });
    }
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 60, 60000)) {
      return res.status(429).json({ error: 'Too many webhook requests.' });
    }

    const rawBodyBuf = (req as any).rawBody;
    if (!rawBodyBuf || rawBodyBuf.length === 0) {
      return res.status(400).json({ error: 'Missing raw webhook request body.' });
    }
    const rawBodyStr = rawBodyBuf.toString('utf8');

    // Authoritative Cashfree Webhook Enforcement
    // Missing timestamp or signature must fail closed in both sandbox and production.
    // Generic webhook settlement is disabled in production/live mode.
    const webhookTimestamp = req.headers['x-webhook-timestamp'];
    const webhookSignature = req.headers['x-webhook-signature'];
    if (!webhookTimestamp || !webhookSignature) {
      return res.status(401).json({ error: 'Missing authoritative Cashfree webhook signature headers.' });
    }

    const verification = await paymentManager.getProvider().verifyWebhook(rawBodyStr, req.headers as any);
    if (!verification.isValid) {
      return res.status(401).json({ error: verification.error || 'Invalid Cashfree webhook signature.' });
    }

      // Generate event ID from validated x-webhook-id or rawBody hash (excluding timestamp so retries share event ID)
      const headerWebhookId = req.headers['x-webhook-id'];
      let eventId: string;
      if (typeof headerWebhookId === 'string' && headerWebhookId.trim().length > 0 && headerWebhookId.trim().length <= 128) {
        eventId = headerWebhookId.trim();
      } else {
        eventId = `wh_${crypto.createHash('sha256').update(rawBodyBuf).digest('hex').slice(0, 32)}`;
      }

      if ((verification.status === 'REFUNDED' || verification.refund) && verification.orderId) {
        const orderId = verification.orderId;
        const refundDetails = verification.refund;
        let merchantRefundId = refundDetails?.refundId;
        let providerRefundId = refundDetails?.providerRefundId;
        const refundAmount = refundDetails?.amount ?? verification.amount ?? 0;
        const refundStatus = refundDetails?.status || (verification.status === 'REFUNDED' ? 'SUCCESS' : 'FAILED');

        if (!merchantRefundId) {
          return res.status(400).json({ error: 'Cannot reconcile refund without merchant refund ID.' });
        }

        const refundCurrency = refundDetails?.currency || verification.currency || '';
        if (refundCurrency !== 'INR') {
          return res.status(400).json({ error: 'Refund currency mismatch against INR.' });
        }

        if (refundStatus === 'SUCCESS') {
          // Authoritative server-to-server verification before reversing
          if (paymentManager.isEnabled() && paymentManager.getProvider()?.isConfigured()) {
            try {
              const authStatus = await paymentManager.getProvider().getRefundStatus(orderId, merchantRefundId);
              if (
                authStatus.status !== 'SUCCESS' ||
                authStatus.orderId !== orderId ||
                authStatus.merchantRefundId !== merchantRefundId ||
                authStatus.currency !== 'INR' ||
                toSafePaise(authStatus.amount) !== toSafePaise(refundAmount)
              ) {
                console.warn(`[Webhook Refund] Authoritative verification mismatch for order ${orderId} / refund ${merchantRefundId}. Reservation preserved as PENDING.`);
                await db.recordWebhookEvent(eventId, verification.event || 'REFUND_STATUS_MISMATCH', orderId, providerRefundId, verification.rawPayload);
                return res.status(409).json({ error: 'Authoritative refund verification mismatch. Reservation preserved as PENDING.' });
              }
              providerRefundId = authStatus.providerRefundId || providerRefundId;
            } catch (authErr: any) {
              console.warn(`[Webhook Refund] Server-to-server verification failed for order ${orderId}:`, authErr?.message || authErr);
              return res.status(503).json({ error: 'Server-to-server refund verification unavailable. Retry later.' });
            }
          }

          const reversed = await db.reverseRefund(
            orderId,
            refundAmount,
            'Cashfree webhook refund confirmation',
            merchantRefundId,
            providerRefundId,
            'INR'
          );
          if (!reversed) {
            return res.status(503).json({ error: 'Refund reversal failed to reconcile in database.' });
          }
          await db.recordWebhookEvent(eventId, verification.event || 'REFUND_SUCCESS_WEBHOOK', orderId, providerRefundId, verification.rawPayload);
          return res.json({ received: true, processed: true, status: 'REFUNDED' });
        } else if (refundStatus === 'FAILED') {
          // Terminal failure: safely release reservation
          if (db.isPostgresAuthoritative()) {
            await db.pg.failRefundReservation(merchantRefundId, orderId);
          }
          await db.recordWebhookEvent(eventId, verification.event || 'REFUND_FAILED_WEBHOOK', orderId, providerRefundId, verification.rawPayload);
          return res.json({ received: true, processed: true, status: 'FAILED' });
        } else {
          // PENDING / ONHOLD / PENDING_APPROVAL: preserve reservation
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
        if (order.status === 'completed' || order.status === 'PAID') {
          const existingPaymentRef = order.paymentRef || (order as any).providerPaymentId;
          if (existingPaymentRef && verification.providerPaymentId !== existingPaymentRef) {
            return res.status(409).json({ error: 'Payment ID mismatch on already-paid order.' });
          }
          await db.recordWebhookEvent(eventId, verification.event || 'PAYMENT_SUCCESS_WEBHOOK', orderId, verification.providerPaymentId, verification.rawPayload);
          return res.json({ received: true, processed: true, message: 'Order already completed.' });
        }

        // Gateway reconciliation: call /orders/{id}/payments to verify directly with provider
        let providerPaymentId = verification.providerPaymentId;
        let paymentMethod = verification.paymentMethod || 'UPI';
        let verifiedAmountINR = order.amount;

        if (paymentManager.isEnabled()) {
          const providerStatus = await paymentManager.getProvider().getPaymentStatus(orderId);
          if (providerStatus.status !== 'PAID' || !providerStatus.providerPaymentId) {
            return res.status(503).json({ error: 'Gateway payment record not in PAID state.' });
          }
          if (providerStatus.currency !== 'INR' || order.currency !== 'INR' || (verification.currency && verification.currency !== 'INR')) {
            return res.status(400).json({ error: 'Payment currency mismatch against INR.' });
          }

          const providerPaise = toSafePaise(providerStatus.amount);
          const webhookPaise = verification.amount !== undefined ? toSafePaise(verification.amount) : null;
          const orderPaise = toSafePaise(order.amount);

          if (providerPaise === null || orderPaise === null || providerPaise !== orderPaise) {
            return res.status(400).json({ error: 'Payment amount mismatch against order record.' });
          }
          if (webhookPaise !== null && webhookPaise !== orderPaise) {
            return res.status(400).json({ error: 'Webhook payload amount mismatch against order record.' });
          }

          providerPaymentId = providerStatus.providerPaymentId;
          paymentMethod = providerStatus.paymentMethod || paymentMethod;
          verifiedAmountINR = providerPaise / 100;
        }

        if (db.isPostgresAuthoritative()) {
          const settlementResult = await db.pg.settlePaymentAtomic({
            orderId,
            providerPaymentId: providerPaymentId.trim(),
            provider: 'cashfree',
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
  }));

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
    const order = await db.getOrderAsync(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const amountINR: number = amount === undefined ? order.amount : Number(amount);
    if (!Number.isFinite(amountINR) || amountINR <= 0 ||
        Math.abs(amountINR * 100 - Math.round(amountINR * 100)) >= 1e-8) {
      return res.status(400).json({ error: 'Invalid refund amount.' });
    }
    const refundPaise: number = Math.round(amountINR * 100);
    const validStatuses = db.isPostgresAuthoritative()
      ? ['PAID', 'PARTIALLY_REFUNDED']
      : ['PAID', 'PARTIALLY_REFUNDED', 'completed', 'PENDING'];
    if (!validStatuses.includes(order.status)) {
      return res.status(409).json({ error: 'Order is not refundable in this state.' });
    }

    const refundReason = (reason && typeof reason === 'string') ? reason : 'Customer refund request';
    const merchantRefundId = (req.body.refundId && typeof req.body.refundId === 'string' ? req.body.refundId.trim() : '') || ('ref_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12));

    // Preflight reservation: reserve remaining refundable amount under FOR UPDATE BEFORE calling payment gateway
    const reservation = await db.reserveRefundAtomic(orderId, refundPaise, merchantRefundId, refundReason);
    if (!reservation.success) {
      return res.status(400).json({
        success: false,
        error: reservation.message || 'Refund reservation failed.'
      });
    }

    if (paymentManager.isEnabled()) {
      try {
        const providerRes = await paymentManager.getProvider().createRefund({
          orderId,
          refundId: merchantRefundId,
          amount: amountINR,
          reason: refundReason
        });

        if (!providerRes.success || providerRes.status === 'FAILED') {
          // Release reservation
          await db.failRefundReservation(merchantRefundId, orderId);
          return res.status(400).json({
            success: false,
            status: 'FAILED',
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
          let providerRefundId = providerRes.raw?.cf_refund_id ? String(providerRes.raw.cf_refund_id) : merchantRefundId;
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
            const authStatus = await paymentManager.getProvider().getRefundStatus(orderId, merchantRefundId);
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
            console.warn('[Refund] Server-to-server verification check deferred:', authErr?.message);
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
        console.warn('[Refund] Provider refund error:', err?.message);
        return res.status(502).json({
          success: false,
          status: 'RECONCILIATION_PENDING',
          error: err?.message || 'Payment gateway communication failure during refund.'
        });
      }
    }

    // In disabled / mock mode (e.g. test environment)
    const reversed = await db.reverseRefund(orderId, amountINR, refundReason, merchantRefundId, undefined, 'INR');
    const updatedOrder = await db.getOrderAsync(orderId);
    return res.json({
      success: reversed,
      orderId,
      refundId: merchantRefundId,
      amount: amountINR,
      status: updatedOrder?.status || 'REFUNDED'
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
        targetAmount: targetAmount ? parseInt(targetAmount, 10) : undefined,
        lazyReason: lazyReason?.trim()
      });
      return res.json({ success: true, nomination });
    }

    const nomination = db.createNominationChallenge(
      nomineeName,
      reason || 'Too lazy to even defend themselves.',
      nominatorName,
      targetAmount ? parseInt(targetAmount, 10) : undefined,
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
  app.get('/api/profile/:id', async (req: Request, res: Response) => {
    let profile: any = null;
    if (db.isPostgresAuthoritative()) {
      profile = await db.pg.getProfile(req.params.id);
    } else {
      profile = db.getProfile(req.params.id);
    }
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found.' });
    }
    res.json({ profile });
  });

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
        const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
        const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);
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
  app.get('/api/og/card/:id', async (req: Request, res: Response) => {
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

    const profile = db.isPostgresAuthoritative() ? await db.pg.getProfile(profileId) : db.getProfile(profileId);
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
  });

  // 404 Catch-all for unhandled API endpoints
  app.all('/api/*', (req: Request, res: Response) => {
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

      const configuredAppUrl = process.env.APP_URL?.trim().replace(/\/+$/, '');
      const defaultOrigin = process.env.NODE_ENV === 'production' ? 'https://lazyproof.online' : `http://localhost:${process.env.PORT || 3000}`;
      const baseUrl = configuredAppUrl || defaultOrigin;
      let rankId = (req.query.rank as string) || (req.query.profile as string);
      const isProfilePath = req.path.startsWith('/profile/') || req.path === '/profile';
      if (!rankId && req.path.startsWith('/profile/')) {
        rankId = req.path.replace(/^\/profile\//, '').replace(/\/+$/, '').trim();
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
      const cleanPath = req.path.replace(/\/+$/, '') || '/';
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
    const clean = pathname.replace(/\/+$/, '') || '/';
    if (staticPagePaths.has(clean)) return true;
    if (clean === '/profile' || clean.startsWith('/profile/')) return true;
    return false;
  };

  // Catch any unmatched /api/* route before SPA routing
  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LAZY v2.0 server running on http://0.0.0.0:${PORT}`);
  });

  // Founder operational alert outbox worker:
  // Run on startup and every 15 seconds with safe unref and PostgreSQL row-claim locks
  if (db.isPostgresAuthoritative()) {
    db.pg.dispatchOperationalOutbox().catch(err => {
      console.error('[Outbox Worker] Startup dispatch error:', err);
    });
  }

  const outboxTimer = setInterval(async () => {
    if (db.isPostgresAuthoritative()) {
      try {
        await db.pg.dispatchOperationalOutbox();
      } catch (err) {
        console.error('[Outbox Worker] Scheduled dispatch failed:', err);
      }
    }
  }, 15000);
  outboxTimer.unref();

  // Bounded scheduled reconciliation worker for older CREATED/PENDING payments and PENDING refunds
  // Uses PostgreSQL advisory lock to prevent duplicate multi-replica operations
  const reconciliationTimer = setInterval(async () => {
    if (db.isPostgresAuthoritative() && paymentManager.isEnabled()) {
      try {
        await db.pg.reconcilePendingTransactions(paymentManager.getProvider());
      } catch (err) {
        console.error('[Reconciliation Worker] Scheduled pass failed:', err);
      }
    }
  }, 60000);
  reconciliationTimer.unref();
}

startServer();

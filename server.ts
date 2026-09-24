import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import sharp from 'sharp';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.ts';
import { generateRoast, generateFallbackRoast } from './server/roast.ts';
import { generateProfileOgSvg, injectProfileMetadata, injectRouteMetadata, ROUTE_SEO } from './server/seo.ts';

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
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'self' https://ai.studio https://*.google.com https://*.run.app https://lazyproof.online",
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

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', product: 'LAZY', version: '2.0' });
  });

  // Leaderboard endpoint (Canonical source of paid ranks with server pagination & period filtering)
  app.get('/api/leaderboard', (req: Request, res: Response) => {
    const period = (req.query.period as 'today' | 'week' | 'month' | 'all') || 'all';
    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined;
    const offset = req.query.offset !== undefined ? parseInt(req.query.offset as string, 10) : undefined;
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit as string, 10) : undefined;
    const filter = (req.query.filter as 'verified' | 'all') || 'verified';

    const data = db.getLeaderboard({ period, page, pageSize, offset, limit, filter });
    res.json({
      ...data,
      timestamp: new Date().toISOString()
    });
  });

  // Create unverified participant claim (Section 5)
  app.post('/api/participant/create', (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 15, 60000)) {
      return res.status(429).json({ error: 'Too many participant claims created. Please wait.' });
    }

    const { name, instagram, website, reason } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Display name is required.' });
    }
    if (name.trim().length > 30) {
      return res.status(400).json({ error: 'Display name cannot exceed 30 characters.' });
    }
    if (containsProfanity(name) || (reason && containsProfanity(reason))) {
      return res.status(400).json({ error: 'Please keep name and reason respectful.' });
    }
    const profile = db.createParticipant({ name, instagram, website, reason });
    res.json({
      success: true,
      profile: db.sanitizeProfile(profile),
      ownerToken: profile.ownerToken
    });
  });

  // Get current #1 and minimum required amount to beat #1
  app.get('/api/rank/top', (req: Request, res: Response) => {
    const topAmount = db.getTopAmount();
    const minAmountToBeatTop = db.getMinAmountToBeatTop();
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

  // Create payment order / initiate claim
  app.post('/api/payment/create-order', (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 30, 60000)) {
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }

    // STRICT PAYMENT DISABLEMENT: Live payments are not approved yet (sandbox disabled in production)
    if (PAYMENT_MODE === 'disabled' || process.env.NODE_ENV === 'production') {
      return res.status(503).json({
        error: 'Payments are currently unavailable until payment processing is enabled.',
        paymentMode: 'disabled'
      });
    }

    const { name, amount, instagram, linkedin, website, reason, lazyReason, profileId } = req.body;
    const providedToken = (req.headers['x-profile-token'] as string) || req.body?.ownerToken;

    // For existing profile upgrades: profile must exist, owner token must be present and valid
    if (profileId) {
      const existing = db.getRawProfile(profileId);
      if (!existing) {
        return res.status(404).json({ error: 'Profile not found.' });
      }
      if (!providedToken || !db.constantTimeMatch(existing.ownerToken, providedToken)) {
        return res.status(403).json({ error: 'Unauthorized: Valid owner token is required to upgrade this profile.' });
      }
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Display name is required.' });
    }

    if (name.trim().length > 30) {
      return res.status(400).json({ error: 'Display name cannot exceed 30 characters.' });
    }

    const num = Number(amount);
    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || !Number.isInteger(num) || parsedAmount < 1 || parsedAmount > 1000000) {
      return res.status(400).json({ error: 'Payment amount must be a whole integer between ₹1 and ₹10,00,000.' });
    }

    if (reason && typeof reason === 'string' && reason.length > 140) {
      return res.status(400).json({ error: 'Reason cannot exceed 140 characters.' });
    }

    if (containsProfanity(name) || (reason && containsProfanity(reason))) {
      return res.status(400).json({ error: 'Please keep name and reason respectful.' });
    }

    const orderId = 'order_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const topAmount = db.getTopAmount();
    const isTop = parsedAmount > topAmount;

    db.trackEvent('checkoutStarts');

    // Authoritative server-side order registration
    db.createOrder({
      orderId,
      name: name.trim(),
      amount: parsedAmount,
      profileId,
      ownerToken: providedToken,
      instagram: db.normalizeInstagram(instagram),
      linkedin: db.normalizeLinkedIn(linkedin),
      website: db.normalizeWebsite(website),
      reason: reason?.trim(),
      lazyReason: lazyReason?.trim()
    });

    res.json({
      orderId,
      name: name.trim(),
      amount: parsedAmount,
      currency: 'INR',
      isTop,
      topAmount,
      minAmountToBeatTop: topAmount + 1,
      profileId,
      instagram: db.normalizeInstagram(instagram),
      linkedin: db.normalizeLinkedIn(linkedin),
      website: db.normalizeWebsite(website),
      reason: reason?.trim(),
      lazyReason: lazyReason?.trim()
    });
  });

  // Server-side Payment Verification (Authoritative: grants rank only upon verified order & payment)
  app.post('/api/payment/verify', (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 25, 60000)) {
      return res.status(429).json({ error: 'Too many verification attempts. Please slow down.' });
    }

    // STRICT PAYMENT DISABLEMENT: Live payments are not approved yet (sandbox disabled in production)
    if (PAYMENT_MODE === 'disabled' || process.env.NODE_ENV === 'production') {
      return res.status(503).json({
        error: 'Payments are currently unavailable until payment processing is enabled.',
        paymentMode: 'disabled'
      });
    }

    const { paymentReference, razorpay_signature, razorpay_payment_id, orderId, instagram, linkedin, website, reason, profileId } = req.body;

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'Order ID is required for payment verification.' });
    }

    const order = db.getOrder(orderId);
    if (!order) {
      return res.status(400).json({ error: 'Invalid or expired payment order ID.' });
    }

    // If order was already completed by the provider webhook
    if (order.status === 'completed') {
      const prof = order.profileId ? db.getProfile(order.profileId) : undefined;
      if (prof) {
        return res.json({
          success: true,
          message: 'Legitimacy Verified via Provider Settlement.',
          profile: prof,
          ownerToken: prof.ownerToken
        });
      }
      return res.status(400).json({ error: 'This payment order has already been verified and claimed.' });
    }

    const effectivePaymentRef = (razorpay_payment_id || paymentReference || '').trim();
    if (!effectivePaymentRef) {
      return res.status(400).json({ error: 'Valid payment reference is required.' });
    }

    const cleanRef = effectivePaymentRef.slice(0, 100);
    if (db.isPaymentRefProcessed(cleanRef)) {
      return res.status(400).json({ error: 'Payment reference has already been processed.' });
    }

    const gatewaySecret = process.env.RAZORPAY_KEY_SECRET || process.env.PAYMENT_WEBHOOK_SECRET;

    // Strict cryptographic signature validation if payment gateway secret is configured
    if (gatewaySecret) {
      if (!razorpay_signature) {
        return res.status(401).json({ error: 'Missing gateway verification signature.' });
      }
      try {
        const expectedSig = crypto
          .createHmac('sha256', gatewaySecret)
          .update(`${orderId}|${cleanRef}`)
          .digest('hex');
        const sigBuf = Buffer.from(razorpay_signature.trim());
        const expectedBuf = Buffer.from(expectedSig);
        if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
          return res.status(401).json({ error: 'Invalid payment signature from gateway.' });
        }
      } catch {
        return res.status(401).json({ error: 'Payment signature validation failed.' });
      }
    } else if (process.env.NODE_ENV === 'production') {
      // In production without configured gateway secrets, direct client claims without verified webhook settlement are prohibited
      return res.status(403).json({
        error: 'Direct client-side verification is disabled in production. Payments must settle via verified gateway webhook.'
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
      ownerToken: result.profile.ownerToken,
      previousTop: result.previousTop ? db.sanitizeProfile(result.previousTop) : undefined
    });
  });

  // Authoritative Provider Webhook (Aggregators)
  app.post('/api/payment/webhook', (req: Request, res: Response) => {
    if (PAYMENT_MODE === 'disabled' || process.env.NODE_ENV === 'production') {
      return res.status(503).json({ error: 'Payment processing is currently disabled.' });
    }
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 60, 60000)) {
      return res.status(429).json({ error: 'Too many webhook requests.' });
    }

    const signature = (req.headers['x-razorpay-signature'] || req.headers['x-webhook-signature']) as string | undefined;
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
    const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));

    // If secret is configured, enforce strict HMAC-SHA256 signature verification
    if (webhookSecret) {
      if (!signature) {
        return res.status(401).json({ error: 'Missing webhook signature header.' });
      }
      try {
        const expectedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(rawBody)
          .digest('hex');

        const sigBuf = Buffer.from(signature.trim());
        const expectedBuf = Buffer.from(expectedSignature);
        if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
          return res.status(401).json({ error: 'Invalid webhook signature.' });
        }
      } catch {
        return res.status(401).json({ error: 'Webhook cryptographic validation failed.' });
      }
    } else if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'PAYMENT_WEBHOOK_SECRET is required in production.' });
    }

    const body = req.body;
    const event = body.event || body.type;

    let orderId: string | undefined;
    let paymentId: string | undefined;

    if (
      event === 'payment.captured' ||
      event === 'order.paid' ||
      body.status === 'SUCCESS' ||
      body.status === 'PAID'
    ) {
      const payment = body.payload?.payment?.entity || body.data?.payment || body;
      paymentId = payment.id || payment.payment_id || payment.referenceId || payment.providerReference;
      orderId = payment.notes?.orderId || payment.order_id || body.payload?.order?.entity?.id || body.orderId;
    }

    if (!orderId || !paymentId) {
      return res.json({ received: true, processed: false, reason: 'Event acknowledged, no claim required.' });
    }

    const order = db.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Referenced order not found.' });
    }

    if (order.status === 'completed') {
      return res.json({ received: true, processed: true, message: 'Order already completed.' });
    }

    const result = db.verifyAndClaimRank({
      name: order.name,
      amount: order.amount,
      paymentRef: paymentId,
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
      return res.status(400).json({ error: result.message || 'Payment claim failed.' });
    }

    return res.json({
      received: true,
      processed: true,
      profileId: result.profile.id,
      rank: result.profile.rank
    });
  });

  // Challenge / Friend Nomination
  app.post('/api/challenge', (req: Request, res: Response) => {
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

    const nomination = db.createNominationChallenge(
      nomineeName,
      reason || 'Too lazy to even defend themselves.',
      nominatorName,
      targetAmount ? parseInt(targetAmount, 10) : undefined,
      lazyReason
    );

    res.json({ success: true, nomination });
  });

  // Secure 'Notify Me' email subscription endpoint
  // Allows users to sign up for email notifications when outranked or when nominated by friends
  const handleNotificationSubscribe = (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 12, 60000)) {
      return res.status(429).json({ error: 'Too many notification requests. Please wait a moment before trying again.' });
    }

    const { email, name, notifyOnOutranked, notifyOnNomination } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const trimmedEmail = email.trim();
    // Strict RFC 5322 regex for email validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (trimmedEmail.length > 100 || !emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address (e.g. you@example.com).' });
    }

    if (name && typeof name === 'string') {
      if (name.trim().length > 40) {
        return res.status(400).json({ error: 'Name cannot exceed 40 characters.' });
      }
      if (containsProfanity(name)) {
        return res.status(400).json({ error: 'Please keep name respectful.' });
      }
    }

    const wantsOutranked = notifyOnOutranked !== false;
    const wantsNomination = notifyOnNomination !== false;

    if (!wantsOutranked && !wantsNomination) {
      return res.status(400).json({ error: 'Please select at least one notification alert type.' });
    }

    const result = db.subscribeNotification({
      email: trimmedEmail,
      name: typeof name === 'string' && name.trim() ? name.trim() : undefined,
      notifyOnOutranked: wantsOutranked,
      notifyOnNomination: wantsNomination,
      ip: clientIp
    });

    res.json({
      success: true,
      message: result.message,
      subscription: {
        id: result.subscription.id,
        email: result.subscription.email,
        name: result.subscription.name,
        notifyOnOutranked: result.subscription.notifyOnOutranked,
        notifyOnNomination: result.subscription.notifyOnNomination,
        createdAt: result.subscription.createdAt
      }
    });
  };

  app.post('/api/notifications/subscribe', handleNotificationSubscribe);
  app.post('/api/notify-me', handleNotificationSubscribe);

  // Get single profile
  app.get('/api/profile/:id', (req: Request, res: Response) => {
    const profile = db.getProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found.' });
    }
    res.json({ profile });
  });

  // Update profile's selected Lazy Reason
  app.post('/api/profile/lazy-reason', (req: Request, res: Response) => {
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
      const updated = db.setProfileLazyReason(profileId, lazyReason.trim(), providedToken);
      if (!updated) {
        return res.status(404).json({ error: 'Profile not found.' });
      }
      res.json({ success: true, profile: updated });
    } catch (err: any) {
      return res.status(403).json({ error: err.message || 'Unauthorized: Token mismatch.' });
    }
  });

  // AI Lazy Roast Generation (Server-side Gemini, cached for permanent sharing)
  app.post('/api/roast', async (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 25, 60000)) {
      return res.status(429).json({ error: 'Too many roast requests. Please wait a moment.' });
    }

    const { profileId, forceRegenerate } = req.body;
    if (!profileId || typeof profileId !== 'string') {
      return res.status(400).json({ error: 'Valid profile ID is required to generate a roast.' });
    }

    const profile = db.getRawProfile(profileId);
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

      const isOwner = providedToken ? db.constantTimeMatch(profile.ownerToken, providedToken) : false;

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
      const updated = db.setProfileRoast(profileId, fallbackRoast);
      res.json({
        success: true,
        roast: fallbackRoast,
        source: 'fallback',
        profile: updated
      });
    }
  });

  // Vote for laziness (+1 social appreciation)
  app.post('/api/vote', (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 30, 60000)) {
      return res.status(429).json({ error: 'Voting rate limit reached. Please wait.' });
    }

    const { profileId } = req.body;
    if (!profileId || typeof profileId !== 'string' || profileId.trim().length === 0 || profileId.length > 64) {
      return res.status(400).json({ error: 'Valid profile ID is required.' });
    }

    const prof = db.getProfile(profileId.trim());
    if (!prof) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    const result = db.voteLazy(profileId.trim(), clientIp);
    res.json(result);
  });

  // Report content (Strict target existence validation and character limits)
  app.post('/api/report', (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 40, 60000)) {
      return res.status(429).json({ error: 'Too many reports submitted. Please wait.' });
    }

    const { targetType, targetId, reason } = req.body;
    const validTypes = ['profile', 'nomination'];
    const effectiveType = (targetType || 'profile').toLowerCase();
    if (!validTypes.includes(effectiveType)) {
      return res.status(400).json({ error: 'Invalid target type. Must be profile or nomination.' });
    }

    if (!targetId || typeof targetId !== 'string' || targetId.trim().length === 0 || targetId.trim().length > 64) {
      return res.status(400).json({ error: 'Valid target ID is required.' });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Reason is required.' });
    }

    if (reason.trim().length > 500) {
      return res.status(400).json({ error: 'Reason cannot exceed 500 characters.' });
    }

    const cleanTargetId = targetId.trim();
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
    res.json({ success: true, message: 'Report submitted for review.' });
  });

  // Contact inquiry / support ticket submission
  app.post('/api/contact', (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 6, 60000)) {
      return res.status(429).json({ error: 'Too many messages sent. Please wait a minute or email raja@xaivon.com directly.' });
    }

    const { name, email, subject, orderId, message } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Full name is required.' });
    }
    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }
    if (!message || typeof message !== 'string' || message.trim().length < 5) {
      return res.status(400).json({ error: 'Please provide a message with at least 5 characters.' });
    }

    const saved = db.submitContact({
      name: name.trim(),
      email: email.trim(),
      subject: (typeof subject === 'string' && subject.trim()) ? subject.trim() : 'General Support',
      orderId: (typeof orderId === 'string' && orderId.trim()) ? orderId.trim() : undefined,
      message: message.trim(),
      ip: clientIp
    });

    res.json({
      success: true,
      message: 'Inquiry received successfully. Our support desk (raja@xaivon.com) will review and reply within 24–48 hours.',
      inquiryId: saved.id
    });
  });

  // Activity feed
  app.get('/api/activity', (req: Request, res: Response) => {
    const activities = db.getActivities();
    res.json({ activities });
  });

  // Global Activity and Claims Heat Map metrics (Authoritative real-time social proof)
  app.get('/api/activity/global', (req: Request, res: Response) => {
    const data = db.getGlobalActivity();
    res.json(data);
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
  app.get('/api/admin/data', (req: Request, res: Response) => {
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
    res.json(db.getAdminData());
  });

  // Protected admin action endpoint (Header-only authentication, constant-time check, no-store)
  app.post('/api/admin/moderate', (req: Request, res: Response) => {
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

    const success = db.moderate(action as any, targetId.trim());
    if (!success) {
      return res.status(404).json({ error: 'Target not found or action could not be applied.' });
    }
    res.json({ success: true, message: `Action ${action} applied successfully.` });
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

    const profile = db.getProfile(profileId);
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
      if (!rankId && req.path.startsWith('/profile/')) {
        rankId = req.path.replace('/profile/', '').trim();
      }

      // 1. Dynamic Profile Page (/?rank=:id or /profile/:id)
      if (rankId) {
        const profile = db.getProfile(rankId);
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

  // Global error handler
  app.use((err: any, req: Request, res: Response, next: any) => {
    console.error('Server error:', err?.message || err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    // Intercept page visits before Vite SPA fallback to serve unique server-injected metadata & JSON-LD
    app.use(async (req: Request, res: Response, next: any) => {
      if (req.method === 'GET') {
        return handlePageRequest(req, res, next, false, undefined, vite);
      }
      next();
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response, next: any) => {
      handlePageRequest(req, res, () => {
        res.sendFile(path.join(distPath, 'index.html'));
      }, true, distPath);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LAZY v2.0 server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

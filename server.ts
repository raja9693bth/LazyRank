import express, { Request, Response } from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.ts';
import { generateRoast, generateFallbackRoast } from './server/roast.ts';

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
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Disable server technology fingerprinting
  app.disable('x-powered-by');

  // Security Headers Middleware
  app.use((req: Request, res: Response, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://ai.studio https://*.google.com https://*.run.app;");
    if (req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  app.use(express.json());

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

  // Genuine live status and session heartbeat (Section 4, 5, 6, 7)
  app.get('/api/stats/live', (req: Request, res: Response) => {
    const sessionId = (req.query.sessionId as string) || undefined;
    const stats = db.getLiveStats(sessionId);
    res.json({
      ...stats,
      timestamp: new Date().toISOString()
    });
  });

  app.post('/api/stats/heartbeat', (req: Request, res: Response) => {
    const { sessionId } = req.body;
    if (sessionId && typeof sessionId === 'string') {
      const result = db.recordHeartbeat(sessionId);
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

    const { name, amount, instagram, linkedin, website, reason, profileId } = req.body;
    const providedToken = (req.headers['x-profile-token'] as string) || req.body?.ownerToken;

    if (profileId) {
      const existing = db.getRawProfile(profileId);
      if (existing && existing.ownerToken && existing.ownerToken !== providedToken) {
        return res.status(403).json({ error: 'Unauthorized: You do not have permission to modify this profile.' });
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

    const orderId = 'order_' + Math.random().toString(36).substring(2, 10);
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
      reason: reason?.trim()
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
      vpa: 'lazy@upi'
    });
  });

  // Server-side Payment Verification (Authoritative: grants rank only upon verified order & payment)
  app.post('/api/payment/verify', (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 25, 60000)) {
      return res.status(429).json({ error: 'Too many verification attempts. Please slow down.' });
    }

    const { paymentReference, instagram, linkedin, website, reason, profileId, orderId } = req.body;

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'Order ID is required for payment verification.' });
    }

    const order = db.getOrder(orderId);
    if (!order) {
      return res.status(400).json({ error: 'Invalid or expired payment order ID.' });
    }

    if (order.status === 'completed') {
      return res.status(400).json({ error: 'This payment order has already been verified and claimed.' });
    }

    if (!paymentReference || typeof paymentReference !== 'string' || paymentReference.trim().length === 0) {
      return res.status(400).json({ error: 'Valid payment reference is required.' });
    }

    const cleanRef = paymentReference.trim().slice(0, 100);
    if (db.isPaymentRefProcessed(cleanRef)) {
      return res.status(400).json({ error: 'Payment reference has already been processed.' });
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

  // Challenge / Friend Nomination
  app.post('/api/challenge', (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 20, 60000)) {
      return res.status(429).json({ error: 'Too many challenges created. Please slow down.' });
    }

    const { nomineeName, reason, nominatorName, targetAmount } = req.body;

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
      targetAmount ? parseInt(targetAmount, 10) : undefined
    );

    res.json({ success: true, nomination });
  });

  // Get single profile
  app.get('/api/profile/:id', (req: Request, res: Response) => {
    const profile = db.getProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found.' });
    }
    res.json({ profile });
  });

  // AI Lazy Roast Generation (Server-side Gemini 3.8 Flash, cached for permanent sharing)
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
      const topProfile = db.getRawProfile('p-aarav-1');
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
    if (!checkRateLimit(clientIp, 40, 60000)) {
      return res.status(429).json({ error: 'Voting rate limit reached. Please wait.' });
    }

    const { profileId } = req.body;
    if (!profileId) {
      return res.status(400).json({ error: 'Profile ID required.' });
    }

    const result = db.voteLazy(profileId, clientIp);
    res.json(result);
  });

  // Report content
  app.post('/api/report', (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp, 10, 60000)) {
      return res.status(429).json({ error: 'Too many reports submitted. Please wait.' });
    }

    const { targetType, targetId, reason } = req.body;
    if (!targetId || !reason) {
      return res.status(400).json({ error: 'Target ID and reason required.' });
    }

    db.reportContent(targetType || 'profile', targetId, reason);
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

  // Analytics tracking
  app.post('/api/analytics/track', (req: Request, res: Response) => {
    const { event } = req.body;
    if (event) {
      db.trackEvent(event);
    }
    res.json({ ok: true });
  });

  // Protected admin data endpoint (Header-only authentication, constant-time check)
  app.get('/api/admin/data', (req: Request, res: Response) => {
    const authHeader = req.headers['authorization'];
    const bearerKey = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;
    const adminKey = (req.headers['x-admin-key'] as string) || bearerKey;

    if (!verifyAdminKey(adminKey)) {
      return res.status(401).json({ error: 'Unauthorized admin access.' });
    }
    res.json(db.getAdminData());
  });

  // Protected admin action endpoint (Header-only authentication, constant-time check)
  app.post('/api/admin/moderate', (req: Request, res: Response) => {
    const authHeader = req.headers['authorization'];
    const bearerKey = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;
    const adminKey = (req.headers['x-admin-key'] as string) || bearerKey;

    if (!verifyAdminKey(adminKey)) {
      return res.status(401).json({ error: 'Unauthorized admin access.' });
    }

    const { action, targetId } = req.body;
    db.moderate(action, targetId);
    res.json({ success: true, message: `Action ${action} applied.` });
  });

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
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LAZY v2.0 server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  UserProfile,
  Nomination,
  PurchaseRecord,
  ClaimHistoryRecord,
  LiveStats,
  GlobalActivityData,
  HourlyActivityBucket,
  DayActivityBucket
} from '../../src/types.ts';

const { Pool } = pg;

export interface SettlePaymentParams {
  orderId: string;
  providerPaymentId: string;
  provider: string;
  amount: number;
  paymentMethod?: string;
  signatureVerified: boolean;
  rawPayload?: any;
}

export interface RefundParams {
  orderId: string;
  merchantRefundId: string;
  providerRefundId?: string;
  amount: number;
  reason: string;
}

export interface CreateOrderParams {
  orderId: string;
  name: string;
  amount: number;
  currency?: string;
  profileId?: string;
  ownerToken?: string;
  orderAccessToken?: string;
  quoteSnapshot?: any;
  instagram?: string;
  linkedin?: string;
  website?: string;
  twitter?: string;
  reason?: string;
  lazyReason?: string;
  paymentMode?: string;
  provider?: string;
  idempotencyKey?: string;
  customerEmail?: string;
  customerPhone?: string;
  consentAccepted?: boolean;
  consentTimestamp?: string;
  consentVersion?: string;
}

export interface ContactInput {
  name: string;
  email: string;
  subject?: string;
  orderId?: string;
  message: string;
}

export interface ContactInquiry {
  id: string;
  name: string;
  email: string;
  subject: string;
  orderId?: string;
  message: string;
  status: string;
  createdAt: string;
}

export function validateContact(body: any): ContactInput {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid contact request body');
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const subject = typeof body.subject === 'string' && body.subject.trim() ? body.subject.trim() : 'General Support';
  const orderId = typeof body.orderId === 'string' && body.orderId.trim() ? body.orderId.trim() : undefined;
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!name) throw new Error('Full name is required.');
  if (name.length > 60) throw new Error('Full name cannot exceed 60 characters.');
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('A valid email address is required.');
  if (email.length > 120) throw new Error('Email address cannot exceed 120 characters.');
  if (subject.length > 100) throw new Error('Subject cannot exceed 100 characters.');
  if (orderId && orderId.length > 64) throw new Error('Order ID cannot exceed 64 characters.');
  if (!message || message.length < 5) throw new Error('Please provide a message with at least 5 characters.');

  return { name, email, subject, orderId, message };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

export function constantTimeMatch(a?: string, b?: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const trimmedA = a.trim();
  const trimmedB = b.trim();
  if (trimmedA.length === 0 || trimmedB.length === 0) return false;
  const bufA = Buffer.from(trimmedA);
  const bufB = Buffer.from(trimmedB);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyOwnerToken(stored: string | undefined | null, provided: string | undefined | null): boolean {
  if (!stored || !provided) return false;
  const cleanProvided = provided.trim();
  if (!cleanProvided) return false;
  const providedHash = hashToken(cleanProvided);
  if (stored.length === 64 && /^[0-9a-f]{64}$/i.test(stored)) {
    return constantTimeMatch(stored, providedHash);
  }
  // Safe migration fallback for legacy plaintext token in dev/test records
  return constantTimeMatch(stored, cleanProvided);
}

/**
 * Calculates current IST day boundaries in UTC.
 * Today is precisely [00:00 IST today, 00:00 IST tomorrow).
 * IST is UTC+05:30.
 */
export function getIstTodayWindow(): {
  startTodayUtc: string;
  endTodayUtc: string;
  startTodayMs: number;
  endTodayMs: number;
  istDateStr: string;
} {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowUtc = Date.now();
  const nowIst = new Date(nowUtc + IST_OFFSET_MS);

  const istMidnightUtcMs = Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate());
  const startTodayMs = istMidnightUtcMs - IST_OFFSET_MS;
  const endTodayMs = startTodayMs + 24 * 60 * 60 * 1000;

  const yyyy = nowIst.getUTCFullYear();
  const mm = String(nowIst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(nowIst.getUTCDate()).padStart(2, '0');
  const istDateStr = `${yyyy}-${mm}-${dd}`;

  return {
    startTodayUtc: new Date(startTodayMs).toISOString(),
    endTodayUtc: new Date(endTodayMs).toISOString(),
    startTodayMs,
    endTodayMs,
    istDateStr
  };
}

export class PostgresDatabase {
  private pool: pg.Pool | null = null;
  private isInitialized = false;

  constructor(connectionString?: string) {
    const connStr = connectionString || process.env.DATABASE_URL;
    if (connStr) {
      if (process.env.NODE_ENV === 'production' && connStr.includes('sslmode=disable')) {
        throw new Error('FATAL: sslmode=disable is strictly forbidden in production environment.');
      }
      const isLocal = (connStr.includes('127.0.0.1') || connStr.includes('localhost')) && process.env.NODE_ENV !== 'production';
      const isSsl = process.env.NODE_ENV === 'production' || (!isLocal && !connStr.includes('sslmode=disable'));
      this.pool = new Pool({
        connectionString: connStr,
        ssl: isSsl ? { rejectUnauthorized: true } : undefined,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    }
  }

  public isAvailable(): boolean {
    return this.pool !== null;
  }

  public async init(): Promise<boolean> {
    if (!this.pool) return false;
    try {
      const client = await this.pool.connect();
      try {
        // 1. Ensure schema_migrations table exists
        await client.query(`
          CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(64) PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            description TEXT
          );
        `);

        // 2. Check if fresh database (profiles table does not exist)
        const checkTableRes = await client.query(`
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = current_schema() AND table_name = 'profiles'
        `);

        if (checkTableRes.rows.length === 0) {
          const schemaPath = path.join(process.cwd(), 'server', 'db', 'schema.sql');
          if (fs.existsSync(schemaPath)) {
            const sql = fs.readFileSync(schemaPath, 'utf-8');
            await client.query(sql);
            console.log('[PostgreSQL] Fresh database initialized with schema.sql.');
          }
        }

        // 3. Check and apply migration 002_remediation if not already recorded
        const migRes = await client.query(
          "SELECT 1 FROM schema_migrations WHERE version = '002_remediation'"
        );
        if (migRes.rows.length === 0) {
          const migPath = path.join(process.cwd(), 'server', 'db', 'migrations', '002_remediation.sql');
          if (!fs.existsSync(migPath)) {
            throw new Error('Required migration 002_remediation.sql is missing.');
          }
          const migSql = fs.readFileSync(migPath, 'utf-8');
          await client.query(migSql);
          console.log('[PostgreSQL] Migration 002_remediation applied successfully.');
        }

        // 4. Check and apply migration 003_final_polish if not already recorded
        const mig003Res = await client.query(
          "SELECT 1 FROM schema_migrations WHERE version = '003_final_polish'"
        );
        if (mig003Res.rows.length === 0) {
          const mig003Path = path.join(process.cwd(), 'server', 'db', 'migrations', '003_final_polish.sql');
          if (!fs.existsSync(mig003Path)) {
            throw new Error('Required migration 003_final_polish.sql is missing.');
          }
          const mig003Sql = fs.readFileSync(mig003Path, 'utf-8');
          await client.query(mig003Sql);
          console.log('[PostgreSQL] Migration 003_final_polish applied successfully.');
        }

        // 5. Check and apply migration 004_today_leaderboard if not already recorded
        const mig004Res = await client.query(
          "SELECT 1 FROM schema_migrations WHERE version = '004_today_leaderboard'"
        );
        if (mig004Res.rows.length === 0) {
          const mig004Path = path.join(process.cwd(), 'server', 'db', 'migrations', '004_today_leaderboard.sql');
          if (!fs.existsSync(mig004Path)) {
            throw new Error('Required migration 004_today_leaderboard.sql is missing.');
          }
          const mig004Sql = fs.readFileSync(mig004Path, 'utf-8');
          await client.query(mig004Sql);
          console.log('[PostgreSQL] Migration 004_today_leaderboard applied successfully.');
        }

        // 6. Check and apply migration 005_operational_workflows if not already recorded
        const mig005Res = await client.query(
          "SELECT 1 FROM schema_migrations WHERE version = '005_operational_workflows'"
        );
        if (mig005Res.rows.length === 0) {
          const mig005Path = path.join(process.cwd(), 'server', 'db', 'migrations', '005_operational_workflows.sql');
          if (!fs.existsSync(mig005Path)) {
            throw new Error('Required migration 005_operational_workflows.sql is missing.');
          }
          const mig005Sql = fs.readFileSync(mig005Path, 'utf-8');
          await client.query(mig005Sql);
          console.log('[PostgreSQL] Migration 005_operational_workflows applied successfully.');
        }

        this.isInitialized = true;
        console.log('[PostgreSQL] Database schema verified and up to date.');
        return true;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[PostgreSQL] Database initialization error:', err);
      return false;
    }
  }

  public async getPool(): Promise<pg.Pool> {
    if (!this.pool) throw new Error('PostgreSQL pool is not configured.');
    return this.pool;
  }

  /**
   * Create or update a payment order in PostgreSQL (Authoritative)
   */
  public async createOrder(order: CreateOrderParams): Promise<void> {
    if (!this.pool) throw new Error('Database unavailable.');
    const tokenHash = order.ownerToken ? hashToken(order.ownerToken) : null;
    const orderAccessTokenHash = order.orderAccessToken ? hashToken(order.orderAccessToken) : null;
    const query = `
      INSERT INTO payment_orders (
        order_id, profile_id, owner_token_hash, order_access_token_hash, quote_snapshot, name, amount, currency, status,
        payment_mode, provider, idempotency_key, customer_email, customer_phone,
        instagram, linkedin, website, twitter, reason, lazy_reason,
        consent_accepted, consent_timestamp, consent_version,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW(), NOW())
      ON CONFLICT (order_id) DO UPDATE SET
        name = EXCLUDED.name,
        amount = EXCLUDED.amount,
        customer_email = COALESCE(EXCLUDED.customer_email, payment_orders.customer_email),
        customer_phone = COALESCE(EXCLUDED.customer_phone, payment_orders.customer_phone),
        instagram = COALESCE(EXCLUDED.instagram, payment_orders.instagram),
        linkedin = COALESCE(EXCLUDED.linkedin, payment_orders.linkedin),
        website = COALESCE(EXCLUDED.website, payment_orders.website),
        twitter = COALESCE(EXCLUDED.twitter, payment_orders.twitter),
        reason = COALESCE(EXCLUDED.reason, payment_orders.reason),
        lazy_reason = COALESCE(EXCLUDED.lazy_reason, payment_orders.lazy_reason),
        idempotency_key = COALESCE(EXCLUDED.idempotency_key, payment_orders.idempotency_key),
        order_access_token_hash = COALESCE(EXCLUDED.order_access_token_hash, payment_orders.order_access_token_hash),
        quote_snapshot = COALESCE(EXCLUDED.quote_snapshot, payment_orders.quote_snapshot),
        consent_accepted = COALESCE(EXCLUDED.consent_accepted, payment_orders.consent_accepted),
        consent_timestamp = COALESCE(EXCLUDED.consent_timestamp, payment_orders.consent_timestamp),
        consent_version = COALESCE(EXCLUDED.consent_version, payment_orders.consent_version),
        updated_at = NOW()
    `;
    await this.pool.query(query, [
      order.orderId,
      order.profileId || null,
      tokenHash,
      orderAccessTokenHash,
      order.quoteSnapshot ? JSON.stringify(order.quoteSnapshot) : null,
      order.name,
      order.amount,
      order.currency || 'INR',
      'PENDING',
      order.paymentMode || 'disabled',
      order.provider || 'cashfree',
      order.idempotencyKey || null,
      order.customerEmail || null,
      order.customerPhone || null,
      order.instagram || null,
      order.linkedin || null,
      order.website || null,
      order.twitter || null,
      order.reason || null,
      order.lazyReason || null,
      Boolean(order.consentAccepted),
      order.consentTimestamp ? new Date(order.consentTimestamp) : null,
      order.consentVersion || null
    ]);
  }

  public mapOrder(r: any): any {
    return {
      orderId: r.order_id,
      profileId: r.profile_id || undefined,
      ownerTokenHash: r.owner_token_hash || r.owner_token || undefined,
      orderAccessTokenHash: r.order_access_token_hash || undefined,
      quoteSnapshot: r.quote_snapshot || undefined,
      name: r.name,
      amount: Number(r.amount),
      currency: r.currency,
      status: r.status === 'completed' ? 'PAID' : r.status,
      paymentMode: r.payment_mode,
      provider: r.provider,
      providerOrderId: r.provider_order_id || undefined,
      paymentSessionId: r.payment_session_id || undefined,
      idempotencyKey: r.idempotency_key || undefined,
      paymentRef: r.cf_payment_id || undefined,
      customerEmail: r.customer_email || undefined,
      customerPhone: r.customer_phone || undefined,
      instagram: r.instagram || undefined,
      linkedin: r.linkedin || undefined,
      website: r.website || undefined,
      twitter: r.twitter || undefined,
      reason: r.reason || undefined,
      lazyReason: r.lazy_reason || undefined,
      consentAccepted: Boolean(r.consent_accepted),
      consentTimestamp: r.consent_timestamp ? new Date(r.consent_timestamp).toISOString() : undefined,
      consentVersion: r.consent_version || undefined,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString()
    };
  }

  /**
   * Fetch an authoritative payment order from PostgreSQL
   */
  public async getOrder(orderId: string): Promise<any | null> {
    if (!this.pool) return null;
    const res = await this.pool.query('SELECT * FROM payment_orders WHERE order_id = $1', [orderId]);
    if (res.rows.length === 0) return null;
    return this.mapOrder(res.rows[0]);
  }

  /**
   * Fetch an authoritative payment order by idempotency key
   */
  public async getOrderByIdempotencyKey(idempotencyKey: string): Promise<any | null> {
    if (!this.pool || !idempotencyKey) return null;
    const res = await this.pool.query('SELECT * FROM payment_orders WHERE idempotency_key = $1 LIMIT 1', [idempotencyKey]);
    if (res.rows.length === 0) return null;
    return this.mapOrder(res.rows[0]);
  }

  /**
   * Update provider session details on order
   */
  public async updateOrderProviderSession(orderId: string, paymentSessionId?: string, providerOrderId?: string, checkoutUrl?: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `UPDATE payment_orders SET
        payment_session_id = COALESCE($1, payment_session_id),
        provider_order_id = COALESCE($2, provider_order_id),
        updated_at = NOW()
       WHERE order_id = $3`,
      [paymentSessionId || null, providerOrderId || null, orderId]
    );
  }

  /**
   * Check if a provider payment reference has already settled
   */
  public async isPaymentRefProcessed(providerPaymentId: string): Promise<boolean> {
    if (!this.pool) return false;
    const res = await this.pool.query(
      'SELECT 1 FROM payment_transactions WHERE provider_payment_id = $1 LIMIT 1',
      [providerPaymentId]
    );
    return res.rows.length > 0;
  }

  /**
   * Atomic Settlement Transaction
   * Commits payment settlement, ledger entry, profile update/creation, and deterministic rank recalculation in ONE ACID transaction.
   */
  public async settlePaymentAtomic(params: SettlePaymentParams): Promise<{
    success: boolean;
    message?: string;
    profile?: UserProfile;
    ownerToken?: string;
    previousTop?: UserProfile;
  }> {
    if (!this.pool) throw new Error('Database unavailable.');
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      // Serialize financial settlement and leaderboard ranking across concurrent transactions
      await client.query('SELECT pg_advisory_xact_lock(987654321)');

      // 1. Lock payment order row FOR UPDATE
      const orderRes = await client.query(
        'SELECT * FROM payment_orders WHERE order_id = $1 FOR UPDATE',
        [params.orderId]
      );

      if (orderRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Order not found.' };
      }

      const order = orderRes.rows[0];

      // Idempotency: If already paid, acknowledge safely without duplicate credits
      if (order.status === 'PAID') {
        const profRes = await client.query('SELECT * FROM profiles WHERE id = $1', [order.profile_id]);
        await client.query('COMMIT');
        return {
          success: true,
          message: 'Order already settled.',
          profile: profRes.rows.length > 0 ? this.mapProfile(profRes.rows[0]) : undefined
        };
      }

      // Settle ONLY CREATED or PENDING orders; reject terminal or refund states
      if (!['CREATED', 'PENDING'].includes(order.status)) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Order state is not settleable' };
      }

      // Verify amount matches order amount in integer paise
      const toPaise = (amt: number): number => {
        if (!Number.isFinite(amt)) throw new Error('Invalid amount');
        const paise = Math.round(amt * 100);
        if (Math.abs(amt * 100 - paise) >= 1e-8) throw new Error('Sub-paise amount');
        return paise;
      };
      if (toPaise(Number(order.amount)) !== toPaise(params.amount)) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Paid amount does not match registered order amount.' };
      }

      // 2. Insert into payment_transactions (provider_payment_id has UNIQUE constraint)
      const txId = 'tx_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      const txRes = await client.query(
        `INSERT INTO payment_transactions (
          id, order_id, provider, provider_payment_id, amount, currency, status, payment_method, signature_verified, raw_payload, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (provider_payment_id) DO NOTHING RETURNING id`,
        [
          txId,
          params.orderId,
          params.provider,
          params.providerPaymentId,
          params.amount,
          'INR',
          'SUCCESS',
          params.paymentMethod || 'UPI',
          params.signatureVerified,
          JSON.stringify(params.rawPayload || {})
        ]
      );

      if (txRes.rowCount !== 1) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Payment ID already processed' };
      }

      // Check current #1 top profile for displacement detection
      const prevTopRes = await client.query(
        "SELECT * FROM profiles WHERE moderation_status = 'active' AND is_verified = TRUE ORDER BY amount DESC, first_verified_at ASC NULLS LAST, id ASC LIMIT 1"
      );
      const previousTop = prevTopRes.rows.length > 0 ? this.mapProfile(prevTopRes.rows[0]) : undefined;

      // 3. Update or Create Profile
      let targetProfileId = order.profile_id;
      let ownerTokenHash: string | undefined;

      if (targetProfileId) {
        // Existing profile upgrade: accumulate verified sponsorship amount
        await client.query(
          `UPDATE profiles SET
            amount = amount + $1,
            first_verified_at = COALESCE(first_verified_at, NOW()),
            instagram = COALESCE($2, instagram),
            linkedin = COALESCE($3, linkedin),
            website = COALESCE($4, website),
            twitter = COALESCE($5, twitter),
            reason = COALESCE($6, reason),
            lazy_reason = COALESCE($7, lazy_reason),
            is_verified = TRUE,
            updated_at = NOW()
          WHERE id = $8`,
          [
            params.amount,
            order.instagram,
            order.linkedin,
            order.website,
            order.twitter,
            order.reason,
            order.lazy_reason,
            targetProfileId
          ]
        );
      } else {
        // Create new profile using client-provided and securely stored hash
        targetProfileId = 'p-' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
        const userId = 'u-' + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
        if (!order.owner_token_hash) {
          throw new Error('Missing client owner token hash; cannot fulfill unowned paid order');
        }
        ownerTokenHash = order.owner_token_hash;

        await client.query(
          `INSERT INTO profiles (
            id, user_id, name, amount, rank, instagram, linkedin, website, twitter, reason, lazy_reason,
            is_verified, first_verified_at, owner_token_hash, moderation_status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, 999999, $5, $6, $7, $8, $9, $10, TRUE, NOW(), $11, 'active', NOW(), NOW())`,
          [
            targetProfileId,
            userId,
            order.name,
            params.amount,
            order.instagram,
            order.linkedin,
            order.website,
            order.twitter,
            order.reason,
            order.lazy_reason,
            ownerTokenHash
          ]
        );
      }

      // 4. Update Order status to PAID
      await client.query(
        `UPDATE payment_orders SET
          status = 'PAID',
          cf_payment_id = $1,
          profile_id = $2,
          owner_token_hash = COALESCE($3, owner_token_hash),
          updated_at = NOW()
        WHERE order_id = $4`,
        [params.providerPaymentId, targetProfileId, ownerTokenHash || null, params.orderId]
      );

      // 5. Insert Rank Ledger Entry (Double-entry balance)
      const ledgerId = 'led_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      await client.query(
        `INSERT INTO rank_ledger (id, profile_id, order_id, type, amount, currency, status, note, created_at)
         VALUES ($1, $2, $3, 'CREDIT', $4, 'INR', 'SETTLED', 'Verified Payment Settlement', NOW())`,
        [ledgerId, targetProfileId, params.orderId, params.amount]
      );

      // 6. Atomically & Deterministically Recalculate All Active Ranks
      // Tie-breaking: higher cumulative amount > earlier first verified timestamp > deterministic id
      await client.query(`
        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY amount DESC, first_verified_at ASC NULLS LAST, id ASC) as new_rank
          FROM profiles
          WHERE moderation_status = 'active' AND is_verified = TRUE
        )
        UPDATE profiles
        SET rank = ranked.new_rank
        FROM ranked
        WHERE profiles.id = ranked.id
      `);

      // 7. Fetch final profile state
      const finalProfRes = await client.query('SELECT * FROM profiles WHERE id = $1', [targetProfileId]);
      const finalProfile = this.mapProfile(finalProfRes.rows[0]);

      // Record claim history
      const chId = 'ch_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      await client.query(
        `INSERT INTO claim_history (id, profile_id, order_id, amount, total_amount, rank, note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          chId,
          targetProfileId,
          params.orderId,
          params.amount,
          finalProfile.amount,
          finalProfile.rank,
          order.profile_id ? 'Rank Boost' : 'Initial Claim'
        ]
      );

      // 8. Enqueue Operational Outbox Event in the SAME ACID transaction
      const outboxId = 'out_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      const outboxPayload = {
        orderId: params.orderId,
        profileId: targetProfileId,
        name: finalProfile.name,
        amount: params.amount,
        rank: finalProfile.rank,
        timestamp: new Date().toISOString()
      };
      await client.query(`
        INSERT INTO operational_outbox (
          id, event_type, order_id, delivery_status, attempts, next_attempt_at, payload, created_at
        ) VALUES (
          $1, 'payment_settled', $2, 'PENDING', 0, NOW(), $3, NOW()
        ) ON CONFLICT (event_type, order_id) DO NOTHING
      `, [outboxId, params.orderId, JSON.stringify(outboxPayload)]);

      await client.query('COMMIT');

      // Asynchronously trigger outbox dispatcher without blocking payment return
      this.dispatchOperationalOutbox().catch(err => {
        console.error('[Outbox] Background dispatch error:', err);
      });

      return {
        success: true,
        message: 'Payment verified and claimed.',
        profile: finalProfile,
        previousTop
      };
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('[PostgreSQL] Atomic settlement error:', err);
      return { success: false, message: err?.message || 'Transaction settlement failed.' };
    } finally {
      client.release();
    }
  }

  /**
   * Preflight refund reservation: reserves refundable amount under FOR UPDATE before calling payment gateway
   */
  public async reserveRefundAtomic(
    orderId: string,
    refundPaise: number,
    merchantRefundId: string,
    reason: string
  ): Promise<{ success: boolean; message?: string; remainingRefundablePaise?: number; statusCode?: number }> {
    if (!this.pool) throw new Error('Database unavailable.');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(987654321)');

      const orderRes = await client.query(
        'SELECT * FROM payment_orders WHERE order_id = $1 FOR UPDATE',
        [orderId]
      );
      if (orderRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Order not found.' };
      }
      const order = orderRes.rows[0];
      if (!['PAID', 'PARTIALLY_REFUNDED'].includes(order.status) && order.status !== 'REFUND_PENDING') {
        await client.query('ROLLBACK');
        return { success: false, message: 'Order is not refundable in this state.' };
      }

      // Check existing row with this merchant ID before summing remaining balance
      const existingRowRes = await client.query(
        'SELECT * FROM refund_reversals WHERE (id = $1 OR merchant_refund_id = $1) FOR UPDATE',
        [merchantRefundId]
      );

      const orderPaise = Math.round(Number(order.amount) * 100);

      if (existingRowRes.rows.length > 0) {
        const existingRow = existingRowRes.rows[0];
        const existingRowPaise = Math.round(Number(existingRow.amount) * 100);
        if (existingRow.order_id === orderId && existingRowPaise === refundPaise) {
          if (existingRow.status === 'PENDING') {
            await client.query('COMMIT');
            return { success: true, message: 'Existing pending refund reservation returned idempotently.' };
          }
          if (existingRow.status === 'SUCCESS') {
            await client.query('COMMIT');
            return { success: true, message: 'Refund already settled.' };
          }
        }
        // mismatched order/amount or FAILED
        await client.query('ROLLBACK');
        return { success: false, message: 'Conflict: Refund ID already exists with mismatched order, amount, or failed status.', statusCode: 409 };
      }

      // New different ID while order is REFUND_PENDING: reject to prevent double refund
      if (order.status === 'REFUND_PENDING') {
        await client.query('ROLLBACK');
        return { success: false, message: 'Order already has a pending refund in progress.', statusCode: 409 };
      }

      // Sum all settled (SUCCESS) and in-flight (PENDING) refunds
      const totalRefRes = await client.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM refund_reversals WHERE order_id = $1 AND status IN ('PENDING', 'SUCCESS')",
        [orderId]
      );
      const existingRefundedPaise = Math.round(Number(totalRefRes.rows[0].total) * 100);
      const remainingPaise = orderPaise - existingRefundedPaise;

      if (refundPaise > remainingPaise) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: `Refund amount (${refundPaise / 100} INR) exceeds remaining refundable amount (${remainingPaise / 100} INR).`,
          remainingRefundablePaise: remainingPaise
        };
      }

      const refundAmountINR = refundPaise / 100;
      await client.query(
        `INSERT INTO refund_reversals
           (id, order_id, merchant_refund_id, provider_refund_id, amount,
            currency, reason, status, created_at, updated_at)
         VALUES ($1, $2, $1, NULL, $3, 'INR', $4, 'PENDING', NOW(), NOW())`,
        [merchantRefundId, orderId, refundAmountINR, reason]
      );

      await client.query(
        "UPDATE payment_orders SET status = 'REFUND_PENDING', updated_at = NOW() WHERE order_id = $1 AND status = 'PAID'",
        [orderId]
      );

      await client.query('COMMIT');
      return { success: true, remainingRefundablePaise: remainingPaise - refundPaise };
    } catch (err: any) {
      await client.query('ROLLBACK');
      return { success: false, message: err?.message || 'Failed to reserve refund.' };
    } finally {
      client.release();
    }
  }

  /**
   * Release or mark failed a refund reservation if provider rejects the request
   */
  public async failRefundReservation(merchantRefundId: string, orderId: string): Promise<void> {
    if (!this.pool) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        "UPDATE refund_reversals SET status = 'FAILED', updated_at = NOW() WHERE id = $1 AND order_id = $2",
        [merchantRefundId, orderId]
      );
      const pendingRes = await client.query(
        "SELECT 1 FROM refund_reversals WHERE order_id = $1 AND status = 'PENDING' LIMIT 1",
        [orderId]
      );
      if (pendingRes.rows.length === 0) {
        const successRes = await client.query(
          "SELECT 1 FROM refund_reversals WHERE order_id = $1 AND status = 'SUCCESS' LIMIT 1",
          [orderId]
        );
        const restoreStatus = successRes.rows.length > 0 ? 'PARTIALLY_REFUNDED' : 'PAID';
        await client.query(
          "UPDATE payment_orders SET status = $1, updated_at = NOW() WHERE order_id = $2 AND status = 'REFUND_PENDING'",
          [restoreStatus, orderId]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[PostgreSQL] failRefundReservation error:', err);
    } finally {
      client.release();
    }
  }

  /**
   * Record a refund attempt as PENDING before provider confirmation
   */
  public async recordRefundPending(params: {
    orderId: string;
    refundId: string;
    amount: number;
    reason: string;
  }): Promise<boolean> {
    const res = await this.reserveRefundAtomic(params.orderId, Math.round(params.amount * 100), params.refundId, params.reason);
    return res.success;
  }

  /**
   * Deduplicate and record a payment webhook event
   */
  public async recordWebhookEvent(
    eventId: string,
    eventType: string,
    orderId?: string | null,
    providerPaymentId?: string | null,
    payload?: unknown
  ): Promise<boolean> {
    if (!this.pool) throw new Error('Webhook inbox unavailable');
    if (!eventId || eventId.length > 128) throw new Error('Invalid webhook event ID');
    const id = `wh_${crypto.randomUUID()}`;
    const result = await this.pool.query(
      `INSERT INTO payment_webhook_events
         (id, event_id, event_type, order_id, provider_payment_id, payload, processed_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
       ON CONFLICT (event_id) DO NOTHING RETURNING id`,
      [id, eventId, eventType, orderId ?? null, providerPaymentId ?? null,
       JSON.stringify(payload ?? {})]
    );
    return result.rowCount === 1;
  }

  /**
   * Atomic Refund & Reversal Transaction
   * Debits rank ledger, updates profile amount, and recalculates leaderboard ranks atomically ONLY upon confirmed refund SUCCESS.
   */
  public async reverseRefundAtomic(params: RefundParams): Promise<{
    success: boolean;
    message?: string;
  }> {
    if (!this.pool) throw new Error('Database unavailable.');
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(987654321)');

      const orderRes = await client.query(
        'SELECT * FROM payment_orders WHERE order_id = $1 FOR UPDATE',
        [params.orderId]
      );

      if (orderRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Order not found.' };
      }

      const order = orderRes.rows[0];
      const orderPaise = Math.round(Number(order.amount) * 100);
      const refundPaise = Math.round(params.amount * 100);
      const profileId = order.profile_id;

      // Locate precisely the PENDING reservation by (order_id, merchant_refund_id)
      const reservationRes = await client.query(
        'SELECT * FROM refund_reversals WHERE order_id = $1 AND (merchant_refund_id = $2 OR id = $2) FOR UPDATE',
        [params.orderId, params.merchantRefundId]
      );

      if (reservationRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, message: `No refund reservation found for order ${params.orderId} and refund ${params.merchantRefundId}.` };
      }

      const reservation = reservationRes.rows[0];
      const resPaise = Math.round(Number(reservation.amount) * 100);

      // Validate exact integer paise match
      if (resPaise !== refundPaise) {
        await client.query('ROLLBACK');
        return { success: false, message: `Refund amount mismatch: reservation has ${resPaise} paise, but received ${refundPaise} paise.` };
      }

      // Check currency
      if (reservation.currency !== 'INR') {
        await client.query('ROLLBACK');
        return { success: false, message: 'Currency mismatch: expected INR.' };
      }

      // If already SUCCESS with the same provider ID, acknowledge idempotently without another ledger debit
      if (reservation.status === 'SUCCESS') {
        if (!params.providerRefundId || reservation.provider_refund_id === params.providerRefundId) {
          await client.query('COMMIT');
          return { success: true, message: 'Refund already settled.' };
        }
        await client.query('ROLLBACK');
        return { success: false, message: 'Conflict: Refund already settled with different provider refund ID.' };
      }

      // If previous provider ID was bound and differs, reject mismatch
      if (reservation.provider_refund_id && params.providerRefundId && reservation.provider_refund_id !== params.providerRefundId) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Conflict: Provider refund ID mismatch.' };
      }

      // Require rowCount === 1 before ledger insert
      const updateRes = await client.query(
        `UPDATE refund_reversals
         SET status = 'SUCCESS', provider_refund_id = $1, updated_at = NOW()
         WHERE id = $2 AND order_id = $3 AND status = 'PENDING'
         RETURNING id`,
        [params.providerRefundId || null, reservation.id, params.orderId]
      );

      if (updateRes.rowCount !== 1) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Could not transition reservation from PENDING to SUCCESS.' };
      }

      // Sum all settled (SUCCESS) refunds including this one
      const totalRefundedRes = await client.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM refund_reversals WHERE order_id = $1 AND status = 'SUCCESS'",
        [params.orderId]
      );
      const settledPaise = Math.round(Number(totalRefundedRes.rows[0].total) * 100);
      const finalOrderStatus = settledPaise >= orderPaise ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

      // Update order status
      await client.query(
        'UPDATE payment_orders SET status = $1, updated_at = NOW() WHERE order_id = $2',
        [finalOrderStatus, params.orderId]
      );

      if (profileId) {
        // Insert negative debit into rank_ledger
        const ledgerId = 'led_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
        await client.query(
          `INSERT INTO rank_ledger (id, profile_id, order_id, type, amount, currency, status, note, created_at)
           VALUES ($1, $2, $3, 'DEBIT_REFUND', $4, 'INR', 'SETTLED', $5, NOW())`,
          [ledgerId, profileId, params.orderId, -params.amount, params.reason]
        );

        // Recalculate profile verified total from ledger
        await client.query(
          `UPDATE profiles SET
            amount = GREATEST(0, (
              SELECT COALESCE(SUM(amount), 0)
              FROM rank_ledger
              WHERE profile_id = $1 AND status = 'SETTLED'
            )),
            updated_at = NOW()
          WHERE id = $1`,
          [profileId]
        );

        // Deterministically recalculate all active ranks
        await client.query(`
          WITH ranked AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY amount DESC, first_verified_at ASC NULLS LAST, id ASC) as new_rank
            FROM profiles
            WHERE moderation_status = 'active' AND is_verified = TRUE
          )
          UPDATE profiles
          SET rank = ranked.new_rank
          FROM ranked
          WHERE profiles.id = ranked.id
        `);
      }

      await client.query('COMMIT');
      return { success: true };
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('[PostgreSQL] Refund reversal error:', err);
      return { success: false, message: err?.message || 'Refund processing failed.' };
    } finally {
      client.release();
    }
  }

  /**
   * Moderation action: hide, ban, remove, or restore profile
   */
  public async moderateProfile(id: string, action: 'hide' | 'ban' | 'remove' | 'restore'): Promise<boolean> {
    if (!this.pool) return false;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const targetStatus = action === 'restore' ? 'active' : action === 'hide' ? 'hidden' : action === 'ban' ? 'banned' : 'removed';
      const updateRes = await client.query('UPDATE profiles SET moderation_status = $1, updated_at = NOW() WHERE id = $2', [targetStatus, id]);

      if ((updateRes.rowCount ?? 0) === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      if (targetStatus !== 'active') {
        await client.query('UPDATE profiles SET rank = 999999 WHERE id = $1', [id]);
      }

      await client.query(`
        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY amount DESC, first_verified_at ASC NULLS LAST, id ASC) as new_rank
          FROM profiles
          WHERE moderation_status = 'active' AND is_verified = TRUE
        )
        UPDATE profiles
        SET rank = ranked.new_rank
        FROM ranked
        WHERE profiles.id = ranked.id
      `);

      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[PostgreSQL] Moderate profile error:', err);
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Authoritative Leaderboard query from PostgreSQL
   * Supports period: 'all' | 'today'
   */
  public async getLeaderboard(options?: {
    period?: string;
    offset?: number;
    limit?: number;
    page?: number;
    pageSize?: number;
    filter?: string;
  }): Promise<{
    profiles: UserProfile[];
    totalCount: number;
    hasMore: boolean;
    page: number;
    pageSize: number;
    totalPages: number;
    period: 'all' | 'today';
    topAmount: number;
    minAmountToBeatTop: number;
    filter: 'verified' | 'all';
    periodStartUtc?: string;
    periodEndUtc?: string;
    rankingBasis?: string;
  }> {
    const rawPeriod = options?.period || 'all';
    if (rawPeriod !== 'all' && rawPeriod !== 'today') {
      throw new Error("Unsupported period; supported periods are 'all' and 'today'.");
    }
    const period = rawPeriod as 'all' | 'today';

    if (!this.pool) {
      return {
        profiles: [],
        totalCount: 0,
        hasMore: false,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        period,
        topAmount: 0,
        minAmountToBeatTop: 1,
        filter: 'verified'
      };
    }

    const limit = Math.min(Math.max(1, options?.limit || options?.pageSize || 20), 100);
    const offset = Math.max(0, options?.offset ?? (options?.page ? (options.page - 1) * limit : 0));
    const isVerifiedOnly = options?.filter !== 'all';

    // Top amount and minAmountToBeatTop are ALWAYS authoritative ALL-TIME values
    const topRes = await this.pool.query(
      "SELECT amount FROM profiles WHERE moderation_status = 'active' AND is_verified = TRUE ORDER BY amount DESC, first_verified_at ASC NULLS LAST, id ASC LIMIT 1"
    );
    const topAmount = topRes.rows.length > 0 ? Number(topRes.rows[0].amount) : 0;
    const minAmountToBeatTop = topAmount + 1;

    if (period === 'today') {
      const { startTodayUtc, endTodayUtc } = getIstTodayWindow();

      const countQuery = `
        WITH today_credits AS (
          SELECT profile_id, order_id, amount
          FROM rank_ledger
          WHERE type = 'CREDIT' AND status = 'SETTLED'
            AND created_at >= $1 AND created_at < $2
        ),
        order_debits AS (
          SELECT l.order_id, SUM(ABS(l.amount)) AS debit_amount
          FROM rank_ledger l
          JOIN today_credits tc ON l.order_id = tc.order_id
          WHERE l.type IN ('DEBIT_REFUND', 'DEBIT_CHARGEBACK') AND l.status = 'SETTLED'
          GROUP BY l.order_id
        ),
        profile_today_orders AS (
          SELECT
            tc.profile_id,
            GREATEST(0, tc.amount - COALESCE(od.debit_amount, 0)) AS order_net_amount
          FROM today_credits tc
          LEFT JOIN order_debits od ON tc.order_id = od.order_id
        ),
        profile_today_totals AS (
          SELECT
            profile_id,
            SUM(order_net_amount) AS today_amount
          FROM profile_today_orders
          GROUP BY profile_id
          HAVING SUM(order_net_amount) > 0
        )
        SELECT COUNT(*) as cnt
        FROM profile_today_totals ptt
        JOIN profiles p ON p.id = ptt.profile_id
        WHERE p.moderation_status = 'active' AND p.is_verified = TRUE;
      `;
      const countRes = await this.pool.query(countQuery, [startTodayUtc, endTodayUtc]);
      const totalCount = parseInt(countRes.rows[0]?.cnt || '0', 10);

      const dataQuery = `
        WITH today_credits AS (
          SELECT profile_id, order_id, amount, created_at AS credit_time
          FROM rank_ledger
          WHERE type = 'CREDIT' AND status = 'SETTLED'
            AND created_at >= $1 AND created_at < $2
        ),
        order_debits AS (
          SELECT l.order_id, SUM(ABS(l.amount)) AS debit_amount
          FROM rank_ledger l
          JOIN today_credits tc ON l.order_id = tc.order_id
          WHERE l.type IN ('DEBIT_REFUND', 'DEBIT_CHARGEBACK') AND l.status = 'SETTLED'
          GROUP BY l.order_id
        ),
        profile_today_orders AS (
          SELECT
            tc.profile_id,
            tc.credit_time,
            GREATEST(0, tc.amount - COALESCE(od.debit_amount, 0)) AS order_net_amount
          FROM today_credits tc
          LEFT JOIN order_debits od ON tc.order_id = od.order_id
        ),
        profile_today_totals AS (
          SELECT
            profile_id,
            SUM(order_net_amount) AS today_amount,
            MIN(credit_time) AS earliest_credit_time
          FROM profile_today_orders
          GROUP BY profile_id
          HAVING SUM(order_net_amount) > 0
        )
        SELECT
          p.*,
          ptt.today_amount,
          ptt.earliest_credit_time,
          ROW_NUMBER() OVER (
            ORDER BY ptt.today_amount DESC, ptt.earliest_credit_time ASC, p.id ASC
          ) as dynamic_period_rank
        FROM profile_today_totals ptt
        JOIN profiles p ON p.id = ptt.profile_id
        WHERE p.moderation_status = 'active' AND p.is_verified = TRUE
        ORDER BY ptt.today_amount DESC, ptt.earliest_credit_time ASC, p.id ASC
        LIMIT $3 OFFSET $4;
      `;
      const res = await this.pool.query(dataQuery, [startTodayUtc, endTodayUtc, limit, offset]);
      const profiles = res.rows.map(r => ({
        ...this.mapProfile(r),
        rank: Number(r.rank), // all-time rank is preserved
        periodRank: Number(r.dynamic_period_rank),
        periodAmountINR: Number(r.today_amount),
        periodCreditSettledAt: r.earliest_credit_time ? new Date(r.earliest_credit_time).toISOString() : undefined
      }));

      return {
        profiles,
        totalCount,
        hasMore: offset + profiles.length < totalCount,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
        period: 'today',
        topAmount,
        minAmountToBeatTop,
        filter: 'verified',
        periodStartUtc: startTodayUtc,
        periodEndUtc: endTodayUtc,
        rankingBasis: 'net_settled_credits_today_ist'
      };
    }

    // ALL-TIME Leaderboard
    const whereClause = isVerifiedOnly
      ? "WHERE moderation_status = 'active' AND is_verified = TRUE"
      : "WHERE moderation_status = 'active'";

    const countRes = await this.pool.query(`SELECT COUNT(*) as cnt FROM profiles ${whereClause}`);
    const totalCount = parseInt(countRes.rows[0].cnt, 10);

    const query = `
      SELECT *, ROW_NUMBER() OVER (ORDER BY amount DESC, first_verified_at ASC NULLS LAST, id ASC) as dynamic_rank
      FROM profiles
      ${whereClause}
      ORDER BY amount DESC, first_verified_at ASC NULLS LAST, id ASC
      LIMIT $1 OFFSET $2
    `;
    const res = await this.pool.query(query, [limit, offset]);
    const profiles = res.rows.map(r => ({
      ...this.mapProfile(r),
      rank: Number(r.dynamic_rank || r.rank)
    }));

    return {
      profiles,
      totalCount,
      hasMore: offset + profiles.length < totalCount,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
      period: 'all',
      topAmount,
      minAmountToBeatTop,
      filter: isVerifiedOnly ? 'verified' : 'all'
    };
  }

  /**
   * Look up profile by ID or public rank number
   */
  public async getProfile(idOrRank: string): Promise<UserProfile | null> {
    if (!this.pool) return null;
    const rankNum = parseInt(idOrRank, 10);
    let query: string;
    let params: any[];

    if (!isNaN(rankNum) && rankNum > 0 && String(rankNum) === idOrRank) {
      query = "SELECT * FROM profiles WHERE rank = $1 AND moderation_status = 'active' AND is_verified = TRUE LIMIT 1";
      params = [rankNum];
    } else {
      query = "SELECT * FROM profiles WHERE id = $1 AND moderation_status = 'active' LIMIT 1";
      params = [idOrRank];
    }

    const res = await this.pool.query(query, params);
    if (res.rows.length === 0) return null;
    return this.mapProfile(res.rows[0]);
  }

  /**
   * Look up raw profile including owner token hash (internal / auth verification only)
   */
  public async getRawProfile(id: string): Promise<any | null> {
    if (!this.pool) return null;
    const res = await this.pool.query('SELECT * FROM profiles WHERE id = $1 LIMIT 1', [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      ...this.mapProfile(r),
      ownerTokenHash: r.owner_token_hash || r.owner_token || undefined,
      ownerToken: r.owner_token || undefined
    };
  }

  /**
   * Get maximum current verified top amount
   */
  public async getTopAmount(): Promise<number> {
    if (!this.pool) return 0;
    const res = await this.pool.query(
      "SELECT amount FROM profiles WHERE moderation_status = 'active' AND is_verified = TRUE ORDER BY amount DESC, first_verified_at ASC NULLS LAST, id ASC LIMIT 1"
    );
    return res.rows.length > 0 ? Number(res.rows[0].amount) : 0;
  }

  public mapProfile(row: any): UserProfile {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      amount: Number(row.amount),
      rank: row.rank,
      instagram: row.instagram || undefined,
      linkedin: row.linkedin || undefined,
      website: row.website || undefined,
      twitter: row.twitter || undefined,
      reason: row.reason || undefined,
      title: row.title || undefined,
      badge: row.badge || undefined,
      lazyReason: row.lazy_reason || undefined,
      roast: row.roast || undefined,
      lazyStreakDays: row.lazy_streak_days || 0,
      isVerified: Boolean(row.is_verified),
      firstVerifiedAt: row.first_verified_at ? new Date(row.first_verified_at).toISOString() : undefined,
      moderationStatus: row.moderation_status || 'active',
      votesCount: row.votes_count || 0,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      rankExpiresAt: row.rank_expires_at ? new Date(row.rank_expires_at).toISOString() : undefined
    };
  }

  /**
   * Authoritative Contact Inquiries Persistence
   */
  public async createContactInquiry(input: ContactInput, ip: string): Promise<ContactInquiry> {
    if (!this.pool) throw new Error('Database unavailable');
    const id = crypto.randomUUID();
    const result = await this.pool.query<any>(
      `INSERT INTO contact_inquiries
        (id, name, email, subject, order_id, message, client_ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, subject, order_id, message, status, created_at`,
      [id, input.name, input.email, input.subject || 'General Support', input.orderId ?? null, input.message, ip]
    );
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      subject: row.subject,
      orderId: row.order_id || undefined,
      message: row.message,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString()
    };
  }

  /**
   * Authoritative Content Reporting Persistence
   */
  public async createReport(input: {
    targetType: 'profile' | 'comment' | 'nomination';
    targetId: string;
    reason: string;
    details?: string;
    clientIp: string;
  }): Promise<{ id: string; success: boolean }> {
    if (!this.pool) throw new Error('Database unavailable');

    if (input.targetType === 'profile') {
      const prof = await this.pool.query('SELECT 1 FROM profiles WHERE id = $1', [input.targetId]);
      if (prof.rows.length === 0) {
        throw new Error('Reported profile does not exist.');
      }
    }

    const id = 'rep_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    await this.pool.query(
      `INSERT INTO reports (id, target_id, target_type, reason, details, client_ip, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())`,
      [id, input.targetId, input.targetType, input.reason, input.details ?? null, input.clientIp]
    );
    return { id, success: true };
  }

  public async resolveReport(reportId: string): Promise<boolean> {
    if (!this.pool) throw new Error('Database unavailable');
    const result = await this.pool.query(
      "UPDATE reports SET status = 'actioned' WHERE id = $1 AND status <> 'actioned' RETURNING id",
      [reportId]
    );
    return result.rowCount === 1;
  }

  public async setProfileLazyReason(profileId: string, lazyReason: string, ownerToken?: string): Promise<UserProfile | null> {
    if (!this.pool) throw new Error('Database unavailable');
    if (!ownerToken || typeof ownerToken !== 'string' || !ownerToken.trim()) {
      throw new Error('Unauthorized: Owner token is required to modify this profile.');
    }

    const res = await this.pool.query(
      'SELECT * FROM profiles WHERE id = $1',
      [profileId]
    );
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    if (!verifyOwnerToken(row.owner_token_hash, ownerToken.trim())) {
      throw new Error('Unauthorized: Invalid owner token for this profile.');
    }

    const updateRes = await this.pool.query(
      'UPDATE profiles SET lazy_reason = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [lazyReason.trim(), profileId]
    );
    if (updateRes.rows.length === 0) return null;
    return this.mapProfile(updateRes.rows[0]);
  }

  public async updateProfileRoast(profileId: string, roast: string): Promise<UserProfile | null> {
    if (!this.pool) throw new Error('Database unavailable');
    const updateRes = await this.pool.query(
      'UPDATE profiles SET roast = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [roast.trim(), profileId]
    );
    if (updateRes.rows.length === 0) return null;
    return this.mapProfile(updateRes.rows[0]);
  }

  /**
   * Durable Social Voting in PostgreSQL
   * Fingerprints voter by client IP + User-Agent + server salt to prevent duplicate votes.
   */
  public async voteProfile(
    profileId: string,
    clientIp: string,
    userAgent?: string
  ): Promise<{ success: boolean; profile?: UserProfile; message: string }> {
    if (!this.pool) throw new Error('Database unavailable');
    const profRes = await this.pool.query('SELECT * FROM profiles WHERE id = $1', [profileId]);
    if (profRes.rows.length === 0) {
      return { success: false, message: 'Profile not found' };
    }
    const row = profRes.rows[0];
    if (row.moderation_status === 'removed' || row.reason === '[Content Removed]') {
      return { success: false, message: 'Profile not available' };
    }

    const salt = process.env.VOTE_SECRET || 'lazyproof_vote_salt_2026';
    const voterFingerprint = crypto
      .createHash('sha256')
      .update(`${clientIp}:${userAgent || ''}:${salt}`)
      .digest('hex');

    const voteId = 'vote_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const insertRes = await this.pool.query(
      `INSERT INTO profile_votes (id, profile_id, voter_fingerprint, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (profile_id, voter_fingerprint) DO NOTHING
       RETURNING id`,
      [voteId, profileId, voterFingerprint]
    );

    if (insertRes.rowCount === 0) {
      return { success: false, message: 'You already voted for this person!' };
    }

    const updateRes = await this.pool.query(
      `UPDATE profiles
       SET votes_count = COALESCE(votes_count, 0) + 1, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [profileId]
    );

    return {
      success: true,
      profile: this.mapProfile(updateRes.rows[0]),
      message: 'Vote recorded!'
    };
  }

  /**
   * Durable Challenge / Nomination Persistence
   */
  public async createNominationChallenge(params: {
    nomineeName: string;
    reason: string;
    nominatorName?: string;
    targetAmount?: number;
    lazyReason?: string;
  }): Promise<Nomination> {
    if (!this.pool) throw new Error('Database unavailable');
    const nomId = 'nom_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const nominator = params.nominatorName?.trim() || 'A Friend';
    const nominee = params.nomineeName.trim();
    const reason = params.reason.trim();
    const lazyReason = params.lazyReason?.trim() || null;
    const targetAmount = params.targetAmount || ((await this.getTopAmount()) + 1);

    await this.pool.query(
      `INSERT INTO nominations (
         id, nominator_name, nominee_name, target_amount, reason, lazy_reason, status, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())`,
      [nomId, nominator, nominee, targetAmount, reason, lazyReason]
    );

    return {
      id: nomId,
      nomineeName: nominee,
      nominatorName: nominator,
      reason,
      lazyReason: lazyReason || undefined,
      targetAmount,
      status: 'active',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Durable Notification Preference Persistence
   */
  public async saveNotificationPreference(params: {
    email: string;
    profileId?: string;
    notifyDisplaced?: boolean;
    notifyDailySummary?: boolean;
  }): Promise<{ id: string; success: boolean }> {
    if (!this.pool) throw new Error('Database unavailable');
    const id = 'notif_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    await this.pool.query(
      `INSERT INTO notification_preferences (
         id, email, profile_id, notify_displaced, notify_daily_summary, created_at
       ) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        id,
        params.email.trim().toLowerCase(),
        params.profileId || null,
        params.notifyDisplaced !== false,
        Boolean(params.notifyDailySummary)
      ]
    );
    return { id, success: true };
  }

  /**
   * Transactional Operational Outbox Worker
   * Dispatches founder alerts asynchronously with row-level locks, bounded retries, and timeouts.
   */
  public async dispatchOperationalOutbox(): Promise<{ processed: number; delivered: number; failed: number }> {
    if (!this.pool) return { processed: 0, delivered: 0, failed: 0 };
    let processed = 0;
    let delivered = 0;
    let failed = 0;

    const client = await this.pool.connect();
    let eventsToDispatch: Array<{ id: string; event_type: string; order_id: string; attempts: number; payload: any }> = [];
    try {
      await client.query('BEGIN');
      const selectRes = await client.query(`
        SELECT id, event_type, order_id, attempts, payload
        FROM operational_outbox
        WHERE (
          delivery_status IN ('PENDING', 'FAILED') AND next_attempt_at <= NOW()
        ) OR (
          delivery_status = 'PROCESSING' AND lease_expires_at IS NOT NULL AND lease_expires_at <= NOW()
        )
        ORDER BY created_at ASC
        LIMIT 10
        FOR UPDATE SKIP LOCKED
      `);

      if (selectRes.rows.length > 0) {
        const ids = selectRes.rows.map(r => r.id);
        await client.query(`
          UPDATE operational_outbox
          SET delivery_status = 'PROCESSING',
              lease_expires_at = NOW() + INTERVAL '30 seconds',
              attempts = attempts + 1
          WHERE id = ANY($1)
        `, [ids]);
        eventsToDispatch = selectRes.rows;
      }
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[Outbox] Failed to claim outbox items:', txErr);
      return { processed: 0, delivered: 0, failed: 0 };
    } finally {
      client.release();
    }

    if (eventsToDispatch.length === 0) {
      return { processed: 0, delivered: 0, failed: 0 };
    }

    for (const ev of eventsToDispatch) {
      processed++;
      try {
        const payload = typeof ev.payload === 'string' ? JSON.parse(ev.payload) : ev.payload;
        await this.sendFounderAlert(payload);
        await this.pool.query(`
          UPDATE operational_outbox
          SET delivery_status = 'DELIVERED',
              sent_at = NOW(),
              lease_expires_at = NULL,
              last_error = NULL
          WHERE id = $1
        `, [ev.id]);
        delivered++;
      } catch (err: any) {
        failed++;
        const errMsg = err?.message || String(err);
        const newAttempts = ev.attempts + 1;
        const newStatus = newAttempts >= 5 ? 'EXHAUSTED' : 'FAILED';
        await this.pool.query(`
          UPDATE operational_outbox
          SET delivery_status = $1,
              next_attempt_at = NOW() + ($2 * INTERVAL '30 seconds'),
              lease_expires_at = NULL,
              last_error = $3
          WHERE id = $4
        `, [newStatus, newAttempts, errMsg.slice(0, 500), ev.id]).catch(() => {});
      }
    }

    return { processed, delivered, failed };
  }

  /**
   * Code-native founder alert sender (Telegram and/or Discord)
   */
  private async sendFounderAlert(payload: any): Promise<void> {
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    const discordUrl = process.env.DISCORD_WEBHOOK_URL;

    // If neither channel is configured, outbox dispatch resolves cleanly without error
    if ((!tgToken || !tgChatId) && !discordUrl) {
      return;
    }

    const orderId = payload.orderId || 'Unknown';
    const name = payload.name || 'Anonymous';
    const amount = payload.amount || 0;
    const rank = payload.rank || 0;
    const timestamp = payload.timestamp || new Date().toISOString();

    const alertText = `🚀 LazyProof Verified Payment\n• Order: ${orderId}\n• Name: ${name}\n• Amount: ₹${amount}\n• Rank: #${rank}\n• Time: ${timestamp}`;

    const dispatchPromises: Promise<any>[] = [];

    if (tgToken && tgChatId) {
      const tgUrl = `https://api.telegram.org/bot${tgToken}/sendMessage`;
      dispatchPromises.push(
        fetch(tgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: tgChatId,
            text: alertText
          }),
          signal: AbortSignal.timeout(5000)
        }).then(async res => {
          if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`Telegram error ${res.status}: ${body.slice(0, 150)}`);
          }
        })
      );
    }

    if (discordUrl) {
      dispatchPromises.push(
        fetch(discordUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `🚀 **LazyProof Verified Payment**\n• **Order**: \`${orderId}\`\n• **Name**: ${name}\n• **Amount**: ₹${amount}\n• **Rank**: #${rank}\n• **Time**: ${timestamp}`
          }),
          signal: AbortSignal.timeout(5000)
        }).then(async res => {
          if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`Discord error ${res.status}: ${body.slice(0, 150)}`);
          }
        })
      );
    }

    await Promise.all(dispatchPromises);
  }

  /**
   * Authoritative Protected Admin Data
   */
  public async getAdminData(limit = 50, offset = 0): Promise<any> {
    if (!this.pool) throw new Error('Database unavailable');

    const profRes = await this.pool.query(
      `SELECT * FROM profiles ORDER BY amount DESC, first_verified_at ASC NULLS LAST, id ASC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const profiles = profRes.rows.map(r => this.mapProfile(r));

    const ordersRes = await this.pool.query(
      `SELECT order_id, profile_id, name, amount, currency, status, payment_mode, provider, customer_email, customer_phone, cf_payment_id, created_at, updated_at
       FROM payment_orders ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const inqRes = await this.pool.query(
      `SELECT id, name, email, subject, order_id, message, status, created_at
       FROM contact_inquiries ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const repRes = await this.pool.query(
      `SELECT id, target_id, target_type, reason, details, status, created_at
       FROM reports ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const nomRes = await this.pool.query(
      `SELECT id, nominator_name, nominee_name, target_amount, reason, lazy_reason, status, created_at
       FROM nominations ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const { startTodayUtc, endTodayUtc } = getIstTodayWindow();
    const statsRes = await this.pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_verified = true AND moderation_status = 'active') as verified_count,
        COALESCE(SUM(amount) FILTER (WHERE is_verified = true AND moderation_status = 'active'), 0) as verified_revenue,
        (SELECT COUNT(*) FROM payment_orders WHERE status = 'PAID') as total_claims,
        (SELECT COUNT(DISTINCT l.order_id)
         FROM rank_ledger l
         WHERE l.type = 'CREDIT' AND l.status = 'SETTLED'
           AND l.created_at >= $1 AND l.created_at < $2) as claims_today,
        (SELECT COUNT(*) FROM payment_orders) as total_orders
      FROM profiles
    `, [startTodayUtc, endTodayUtc]);
    const s = statsRes.rows[0];

    const stats = {
      totalVerifiedParticipants: parseInt(s?.verified_count || '0', 10),
      totalVerifiedRevenue: parseFloat(s?.verified_revenue || '0'),
      totalClaims: parseInt(s?.total_claims || '0', 10),
      claimsToday: parseInt(s?.claims_today || '0', 10),
      topAmount: profiles[0]?.amount || 0,
      minAmountToBeatTop: (profiles[0]?.amount || 0) + 1
    };

    const orders = ordersRes.rows.map(o => ({
      orderId: o.order_id,
      profileId: o.profile_id || null,
      name: o.name,
      amount: Number(o.amount),
      currency: o.currency,
      status: o.status,
      paymentMode: o.payment_mode,
      provider: o.provider,
      customerEmail: o.customer_email || null,
      customerPhone: o.customer_phone || null,
      cfPaymentId: o.cf_payment_id || null,
      createdAt: new Date(o.created_at).toISOString(),
      updatedAt: new Date(o.updated_at).toISOString()
    }));

    const inquiries = inqRes.rows.map(i => ({
      id: i.id,
      name: i.name,
      email: i.email,
      subject: i.subject,
      orderId: i.order_id || null,
      message: i.message,
      status: i.status,
      createdAt: new Date(i.created_at).toISOString()
    }));

    const reports = repRes.rows.map(r => ({
      id: r.id,
      targetId: r.target_id,
      targetType: r.target_type,
      reason: r.reason,
      details: r.details || null,
      status: r.status,
      createdAt: new Date(r.created_at).toISOString()
    }));

    const nominations = nomRes.rows.map(n => ({
      id: n.id,
      nominatorName: n.nominator_name,
      nomineeName: n.nominee_name,
      targetAmount: n.target_amount ? Number(n.target_amount) : null,
      reason: n.reason,
      lazyReason: n.lazy_reason || undefined,
      status: n.status,
      createdAt: new Date(n.created_at).toISOString()
    }));

    return {
      profiles,
      orders,
      inquiries,
      reports,
      nominations,
      stats,
      liveStats: stats,
      analytics: {
        totalRevenueINR: stats.totalVerifiedRevenue,
        successfulPurchases: stats.totalClaims,
        homepageViews: 0,
        shareClicks: 0
      },
      pagination: {
        limit,
        offset,
        totalOrders: parseInt(s?.total_orders || '0', 10)
      },
      serverTime: new Date().toISOString()
    };
  }

  /**
   * Authoritative Global Activity from settled PostgreSQL records
   */
  public async getGlobalActivity(): Promise<GlobalActivityData> {
    if (!this.pool) {
      return {
        claimsToday: 0,
        claimsTotal: 0,
        totalAmountToday: 0,
        hourlyActivity: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          label: hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`,
          claimsCount: 0,
          amount: 0,
          intensity: 0,
          isCurrentHour: hour === new Date().getHours()
        })),
        recentDays: [],
        peakHour: 'None recorded yet',
        latestClaimMinutesAgo: null,
        activeParticipantsNow: 0,
        updatedAt: new Date().toISOString()
      };
    }

    const { startTodayUtc, endTodayUtc } = getIstTodayWindow();
    const nowIst = new Date(Date.now() + 5.5 * 3600 * 1000);
    const currentIstHour = nowIst.getUTCHours();

    // 1. Claims today & Total amount today in IST window
    const todayRes = await this.pool.query(
      `SELECT COUNT(*) as claims_today, COALESCE(SUM(amount), 0) as total_amount_today
       FROM rank_ledger
       WHERE type = 'CREDIT' AND status = 'SETTLED'
         AND created_at >= $1 AND created_at < $2`,
      [startTodayUtc, endTodayUtc]
    );
    const claimsToday = parseInt(todayRes.rows[0]?.claims_today || '0', 10);
    const totalAmountToday = parseFloat(todayRes.rows[0]?.total_amount_today || '0');

    // 2. Lifetime claims total
    const totalClaimsRes = await this.pool.query(
      `SELECT COUNT(*) as claims_total FROM rank_ledger WHERE type = 'CREDIT' AND status = 'SETTLED'`
    );
    const claimsTotal = parseInt(totalClaimsRes.rows[0]?.claims_total || '0', 10);

    // 3. Hourly activity in today's IST window (0 to 23 IST hours)
    const hourlyRes = await this.pool.query(
      `SELECT
         EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata')::int as hour,
         COUNT(*) as count,
         COALESCE(SUM(amount), 0) as amount
       FROM rank_ledger
       WHERE type = 'CREDIT' AND status = 'SETTLED'
         AND created_at >= $1 AND created_at < $2
       GROUP BY hour`,
      [startTodayUtc, endTodayUtc]
    );

    const hourlyMap = new Map<number, { count: number; amount: number }>();
    let peakClaims = 0;
    let peakHourIndex = currentIstHour;

    for (const row of hourlyRes.rows) {
      const h = Number(row.hour);
      const count = parseInt(row.count, 10);
      const amt = parseFloat(row.amount);
      hourlyMap.set(h, { count, amount: amt });
      if (count > peakClaims) {
        peakClaims = count;
        peakHourIndex = h;
      }
    }

    const formatHour = (h: number): string => {
      if (h === 0) return '12 AM';
      if (h < 12) return `${h} AM`;
      if (h === 12) return '12 PM';
      return `${h - 12} PM`;
    };

    const hourlyActivity: HourlyActivityBucket[] = [];
    for (let h = 0; h < 24; h++) {
      const data = hourlyMap.get(h);
      const count = data?.count || 0;
      const amt = data?.amount || 0;
      let intensity = 0;
      if (count >= 5) intensity = 4;
      else if (count >= 3) intensity = 3;
      else if (count >= 2) intensity = 2;
      else if (count >= 1) intensity = 1;

      hourlyActivity.push({
        hour: h,
        label: formatHour(h),
        claimsCount: count,
        amount: amt,
        intensity,
        isCurrentHour: h === currentIstHour
      });
    }

    // 4. Recent 7 days activity in IST
    const sevenDaysAgoMs = Date.now() - 7 * 24 * 3600 * 1000;
    const sevenDaysAgoIst = new Date(sevenDaysAgoMs + 5.5 * 3600 * 1000);
    const start7DaysUtc = new Date(Date.UTC(sevenDaysAgoIst.getUTCFullYear(), sevenDaysAgoIst.getUTCMonth(), sevenDaysAgoIst.getUTCDate()) - 5.5 * 3600 * 1000).toISOString();

    const recentDaysRes = await this.pool.query(
      `SELECT
         TO_CHAR(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') as date_str,
         COUNT(*) as count,
         COALESCE(SUM(amount), 0) as amount
       FROM rank_ledger
       WHERE type = 'CREDIT' AND status = 'SETTLED'
         AND created_at >= $1
       GROUP BY date_str`,
      [start7DaysUtc]
    );

    const recentDaysMap = new Map<string, { count: number; amount: number }>();
    for (const r of recentDaysRes.rows) {
      recentDaysMap.set(r.date_str, { count: parseInt(r.count, 10), amount: parseFloat(r.amount) });
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const recentDays: DayActivityBucket[] = [];
    for (let i = 6; i >= 0; i--) {
      const dIst = new Date(Date.now() + 5.5 * 3600 * 1000 - i * 24 * 3600 * 1000);
      const yyyy = dIst.getUTCFullYear();
      const mm = String(dIst.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(dIst.getUTCDate()).padStart(2, '0');
      const dStr = `${yyyy}-${mm}-${dd}`;
      const dayName = dayNames[dIst.getUTCDay()];
      const isToday = i === 0;

      const data = recentDaysMap.get(dStr);
      const count = isToday ? claimsToday : (data?.count || 0);
      const amt = isToday ? totalAmountToday : (data?.amount || 0);

      let intensity = 0;
      if (count >= 12) intensity = 4;
      else if (count >= 8) intensity = 3;
      else if (count >= 5) intensity = 2;
      else if (count >= 1) intensity = 1;

      recentDays.push({
        date: dStr,
        dayName,
        claimsCount: count,
        amount: amt,
        intensity,
        isToday
      });
    }

    const peakHour = peakClaims > 0
      ? `${formatHour(peakHourIndex)} – ${formatHour((peakHourIndex + 1) % 24)}`
      : 'None recorded yet';

    // 5. Latest claim minutes ago
    const latestRes = await this.pool.query(
      `SELECT created_at FROM rank_ledger WHERE type = 'CREDIT' AND status = 'SETTLED' ORDER BY created_at DESC LIMIT 1`
    );
    let latestClaimMinutesAgo: number | null = null;
    if (latestRes.rows.length > 0) {
      const diffMs = Date.now() - new Date(latestRes.rows[0].created_at).getTime();
      latestClaimMinutesAgo = Math.max(0, Math.floor(diffMs / 60000));
    }

    const verifiedProfilesRes = await this.pool.query(
      "SELECT COUNT(*) as cnt FROM profiles WHERE is_verified = true AND moderation_status = 'active'"
    );
    const activeParticipantsNow = parseInt(verifiedProfilesRes.rows[0]?.cnt || '0', 10);

    return {
      claimsToday,
      claimsTotal,
      totalAmountToday,
      hourlyActivity,
      recentDays,
      peakHour,
      latestClaimMinutesAgo,
      activeParticipantsNow,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Bounded database-backed rate limiter using api_rate_limits
   */
  public async checkRateLimit(key: string, maxPoints: number, windowMs: number): Promise<boolean> {
    if (!this.pool) return true;
    try {
      const expireAt = new Date(Date.now() + windowMs);
      const query = `
        INSERT INTO api_rate_limits (key, points, expire_at)
        VALUES ($1, 1, $2)
        ON CONFLICT (key) DO UPDATE
        SET points = CASE
              WHEN api_rate_limits.expire_at < NOW() THEN 1
              ELSE api_rate_limits.points + 1
            END,
            expire_at = CASE
              WHEN api_rate_limits.expire_at < NOW() THEN EXCLUDED.expire_at
              ELSE api_rate_limits.expire_at
            END
        RETURNING points;
      `;
      const res = await this.pool.query(query, [key, expireAt]);
      const currentPoints = res.rows[0]?.points || 1;
      return currentPoints <= maxPoints;
    } catch (err) {
      console.error('[PostgreSQL] checkRateLimit error:', err);
      return true;
    }
  }

  /**
   * Reconcile pending payments and refunds using PostgreSQL advisory lock
   * Prevents multi-replica duplicate work.
   */
  public async reconcilePendingTransactions(provider: any): Promise<{ reconciledOrders: number; reconciledRefunds: number }> {
    if (!this.pool) return { reconciledOrders: 0, reconciledRefunds: 0 };
    const client = await this.pool.connect();
    let reconciledOrders = 0;
    let reconciledRefunds = 0;

    try {
      const lockRes = await client.query('SELECT pg_try_advisory_lock(554433221) AS locked');
      if (!lockRes.rows[0]?.locked) {
        return { reconciledOrders: 0, reconciledRefunds: 0 };
      }

      try {
        // Query up to 20 PENDING / CREATED orders between 5 minutes and 24 hours old
        const pendingOrdersRes = await client.query(
          `SELECT order_id, amount, status FROM payment_orders
           WHERE status IN ('PENDING', 'CREATED')
             AND created_at <= NOW() - INTERVAL '5 minutes'
             AND created_at >= NOW() - INTERVAL '24 hours'
           ORDER BY created_at ASC
           LIMIT 20`
        );

        for (const order of pendingOrdersRes.rows) {
          try {
            const providerStatus = await provider.getPaymentStatus(order.order_id);
            if (providerStatus.status === 'PAID' && providerStatus.providerPaymentId) {
              const toPaise = (amt: number): number => Math.round(amt * 100);
              if (providerStatus.amount !== undefined && toPaise(providerStatus.amount) === toPaise(Number(order.amount))) {
                const res = await this.settlePaymentAtomic({
                  orderId: order.order_id,
                  providerPaymentId: providerStatus.providerPaymentId,
                  provider: provider.name || 'cashfree',
                  amount: Number(order.amount),
                  paymentMethod: providerStatus.paymentMethod || 'UPI',
                  signatureVerified: false
                });
                if (res.success) reconciledOrders++;
              }
            }
          } catch (orderErr) {
            console.warn(`[Reconciliation] Order ${order.order_id} check failed:`, orderErr);
          }
        }

        // Query up to 20 PENDING refunds between 5 minutes and 24 hours old
        const pendingRefundsRes = await client.query(
          `SELECT order_id, merchant_refund_id, id, amount, reason FROM refund_reversals
           WHERE status = 'PENDING'
             AND created_at <= NOW() - INTERVAL '5 minutes'
             AND created_at >= NOW() - INTERVAL '24 hours'
           ORDER BY created_at ASC
           LIMIT 20`
        );

        for (const ref of pendingRefundsRes.rows) {
          const merchantRefId = ref.merchant_refund_id || ref.id;
          try {
            const refundStatus = await provider.getRefundStatus(ref.order_id, merchantRefId);
            if (refundStatus.status === 'SUCCESS' && refundStatus.providerRefundId) {
              const res = await this.reverseRefundAtomic({
                orderId: ref.order_id,
                merchantRefundId: merchantRefId,
                amount: Number(ref.amount),
                reason: ref.reason || 'Reconciled refund',
                providerRefundId: refundStatus.providerRefundId
              });
              if (res.success) reconciledRefunds++;
            } else if (refundStatus.status === 'FAILED') {
              await this.failRefundReservation(merchantRefId, ref.order_id);
              reconciledRefunds++;
            }
          } catch (refErr) {
            console.warn(`[Reconciliation] Refund ${merchantRefId} check failed:`, refErr);
          }
        }
      } finally {
        await client.query('SELECT pg_advisory_unlock(554433221)');
      }
    } catch (err) {
      console.error('[Reconciliation] Error:', err);
    } finally {
      client.release();
    }

    return { reconciledOrders, reconciledRefunds };
  }
}

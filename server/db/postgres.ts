import pg from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { UserProfile, PurchaseRecord, ClaimHistoryRecord, LiveStats } from '../../src/types.ts';

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
  instagram?: string;
  linkedin?: string;
  website?: string;
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

export class PostgresDatabase {
  private pool: pg.Pool | null = null;
  private isInitialized = false;

  constructor(connectionString?: string) {
    const connStr = connectionString || process.env.DATABASE_URL;
    if (connStr) {
      const isSsl = process.env.NODE_ENV === 'production' && !connStr.includes('127.0.0.1') && !connStr.includes('localhost');
      this.pool = new Pool({
        connectionString: connStr,
        ssl: isSsl ? { rejectUnauthorized: false } : undefined,
        max: 20,
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
        const schemaPath = path.join(process.cwd(), 'server', 'db', 'schema.sql');
        if (fs.existsSync(schemaPath)) {
          const sql = fs.readFileSync(schemaPath, 'utf-8');
          await client.query(sql);
        }
        this.isInitialized = true;
        console.log('[PostgreSQL] Database schema verified and initialized.');
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
    const query = `
      INSERT INTO payment_orders (
        order_id, profile_id, owner_token_hash, name, amount, currency, status,
        payment_mode, provider, idempotency_key, customer_email, customer_phone,
        instagram, linkedin, website, reason, lazy_reason,
        consent_accepted, consent_timestamp, consent_version,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW())
      ON CONFLICT (order_id) DO UPDATE SET
        name = EXCLUDED.name,
        amount = EXCLUDED.amount,
        customer_email = COALESCE(EXCLUDED.customer_email, payment_orders.customer_email),
        customer_phone = COALESCE(EXCLUDED.customer_phone, payment_orders.customer_phone),
        instagram = COALESCE(EXCLUDED.instagram, payment_orders.instagram),
        linkedin = COALESCE(EXCLUDED.linkedin, payment_orders.linkedin),
        website = COALESCE(EXCLUDED.website, payment_orders.website),
        reason = COALESCE(EXCLUDED.reason, payment_orders.reason),
        lazy_reason = COALESCE(EXCLUDED.lazy_reason, payment_orders.lazy_reason),
        idempotency_key = COALESCE(EXCLUDED.idempotency_key, payment_orders.idempotency_key),
        consent_accepted = COALESCE(EXCLUDED.consent_accepted, payment_orders.consent_accepted),
        consent_timestamp = COALESCE(EXCLUDED.consent_timestamp, payment_orders.consent_timestamp),
        consent_version = COALESCE(EXCLUDED.consent_version, payment_orders.consent_version),
        updated_at = NOW()
    `;
    await this.pool.query(query, [
      order.orderId,
      order.profileId || null,
      tokenHash,
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

      // Idempotency: If already paid, acknowledge
      if (order.status === 'PAID') {
        const profRes = await client.query('SELECT * FROM profiles WHERE id = $1', [order.profile_id]);
        await client.query('COMMIT');
        if (profRes.rows.length > 0) {
          const profile = this.mapProfile(profRes.rows[0]);
          return {
            success: true,
            message: 'Order already settled.',
            profile,
            ownerToken: order.owner_token
          };
        }
      }

      // Verify amount matches order amount
      const orderAmount = Number(order.amount);
      if (Math.abs(orderAmount - params.amount) > 0.01) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Paid amount does not match registered order amount.' };
      }

      // 2. Insert into payment_transactions (provider_payment_id has UNIQUE constraint)
      const txId = 'tx_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      await client.query(
        `INSERT INTO payment_transactions (
          id, order_id, provider, provider_payment_id, amount, currency, status, payment_method, signature_verified, raw_payload, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (provider_payment_id) DO NOTHING`,
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

      // Check current #1 top profile for displacement detection
      const prevTopRes = await client.query(
        "SELECT * FROM profiles WHERE moderation_status = 'active' AND is_verified = TRUE ORDER BY amount DESC, updated_at ASC, id ASC LIMIT 1"
      );
      const previousTop = prevTopRes.rows.length > 0 ? this.mapProfile(prevTopRes.rows[0]) : undefined;

      // 3. Update or Create Profile
      let targetProfileId = order.profile_id;
      let rawOwnerToken: string | undefined;
      let ownerTokenHash: string | undefined;

      if (targetProfileId) {
        // Existing profile upgrade: accumulate verified sponsorship amount
        await client.query(
          `UPDATE profiles SET
            amount = amount + $1,
            instagram = COALESCE($2, instagram),
            linkedin = COALESCE($3, linkedin),
            website = COALESCE($4, website),
            reason = COALESCE($5, reason),
            lazy_reason = COALESCE($6, lazy_reason),
            is_verified = TRUE,
            updated_at = NOW()
          WHERE id = $7`,
          [
            params.amount,
            order.instagram,
            order.linkedin,
            order.website,
            order.reason,
            order.lazy_reason,
            targetProfileId
          ]
        );
      } else {
        // Create new profile
        targetProfileId = 'p-' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
        const userId = 'u-' + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
        rawOwnerToken = 'lazy_' + crypto.randomUUID().replace(/-/g, '') + crypto.randomBytes(16).toString('hex');
        ownerTokenHash = hashToken(rawOwnerToken);

        await client.query(
          `INSERT INTO profiles (
            id, user_id, name, amount, rank, instagram, linkedin, website, reason, lazy_reason,
            is_verified, owner_token_hash, moderation_status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, 999999, $5, $6, $7, $8, $9, TRUE, $10, 'active', NOW(), NOW())`,
          [
            targetProfileId,
            userId,
            order.name,
            params.amount,
            order.instagram,
            order.linkedin,
            order.website,
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
      // Tie-breaking: higher cumulative amount > earlier update timestamp > deterministic id
      await client.query(`
        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY amount DESC, updated_at ASC, id ASC) as new_rank
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

      await client.query('COMMIT');

      return {
        success: true,
        message: 'Payment verified and claimed.',
        profile: finalProfile,
        ownerToken: rawOwnerToken,
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
   * Record a refund attempt as PENDING before provider confirmation
   */
  public async recordRefundPending(params: {
    orderId: string;
    refundId: string;
    amount: number;
    reason: string;
  }): Promise<boolean> {
    if (!this.pool) return false;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const orderRes = await client.query('SELECT * FROM payment_orders WHERE order_id = $1 FOR UPDATE', [params.orderId]);
      if (orderRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }
      // Insert or update refund_reversals record with status PENDING
      await client.query(
        `INSERT INTO refund_reversals (id, order_id, provider_refund_id, amount, currency, reason, status, created_at)
         VALUES ($1, $2, $3, $4, 'INR', $5, 'PENDING', NOW())
         ON CONFLICT (id) DO UPDATE SET status = 'PENDING'`,
        [params.refundId, params.orderId, params.refundId, params.amount, params.reason]
      );
      await client.query("UPDATE payment_orders SET status = 'REFUND_PENDING', updated_at = NOW() WHERE order_id = $1", [params.orderId]);
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[PostgreSQL] recordRefundPending error:', err);
      return false;
    } finally {
      client.release();
    }
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
      const orderAmount = Number(order.amount);
      const profileId = order.profile_id;

      // Idempotency: If providerRefundId is supplied and already settled with SUCCESS, return immediately
      if (params.providerRefundId) {
        const existingRef = await client.query(
          "SELECT 1 FROM refund_reversals WHERE (provider_refund_id = $1 OR id = $1) AND status = 'SUCCESS' LIMIT 1",
          [params.providerRefundId]
        );
        if (existingRef.rows.length > 0) {
          await client.query('COMMIT');
          return { success: true, message: 'Refund reversal already settled.' };
        }
      }

      // Check total settled refunds so far
      const totalRefundedRes = await client.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM refund_reversals WHERE order_id = $1 AND status = 'SUCCESS'",
        [params.orderId]
      );
      const alreadyRefunded = Number(totalRefundedRes.rows[0].total);

      if (alreadyRefunded + params.amount > orderAmount + 0.01) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Total refund amount exceeds original successfully captured payment.' };
      }

      // Record refund reversal with status SUCCESS
      const refId = params.providerRefundId || ('ref_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12));
      await client.query(
        `INSERT INTO refund_reversals (id, order_id, provider_refund_id, amount, currency, reason, status, created_at)
         VALUES ($1, $2, $3, $4, 'INR', $5, 'SUCCESS', NOW())
         ON CONFLICT (id) DO UPDATE SET status = 'SUCCESS', amount = EXCLUDED.amount, updated_at = NOW()`,
        [refId, params.orderId, params.providerRefundId || null, params.amount, params.reason]
      );

      const newTotalRefunded = alreadyRefunded + params.amount;
      const finalOrderStatus = newTotalRefunded >= orderAmount - 0.01 ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

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
            SELECT id, ROW_NUMBER() OVER (ORDER BY amount DESC, updated_at ASC, id ASC) as new_rank
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
      await client.query('UPDATE profiles SET moderation_status = $1, updated_at = NOW() WHERE id = $2', [targetStatus, id]);

      if (targetStatus !== 'active') {
        await client.query('UPDATE profiles SET rank = 999999 WHERE id = $1', [id]);
      }

      await client.query(`
        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY amount DESC, updated_at ASC, id ASC) as new_rank
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
    topAmount: number;
    minAmountToBeatTop: number;
  }> {
    if (!this.pool) {
      return { profiles: [], totalCount: 0, hasMore: false, page: 1, pageSize: 20, topAmount: 0, minAmountToBeatTop: 1 };
    }

    const limit = Math.min(Math.max(1, options?.limit || options?.pageSize || 20), 100);
    const offset = Math.max(0, options?.offset ?? (options?.page ? (options.page - 1) * limit : 0));
    const isVerifiedOnly = options?.filter !== 'all';

    const whereClause = isVerifiedOnly
      ? "WHERE moderation_status = 'active' AND is_verified = TRUE"
      : "WHERE moderation_status = 'active'";

    const countRes = await this.pool.query(`SELECT COUNT(*) as cnt FROM profiles ${whereClause}`);
    const totalCount = parseInt(countRes.rows[0].cnt, 10);

    const query = `
      SELECT *, ROW_NUMBER() OVER (ORDER BY amount DESC, updated_at ASC, id ASC) as dynamic_rank
      FROM profiles
      ${whereClause}
      ORDER BY amount DESC, updated_at ASC, id ASC
      LIMIT $1 OFFSET $2
    `;
    const res = await this.pool.query(query, [limit, offset]);
    const profiles = res.rows.map(r => ({
      ...this.mapProfile(r),
      rank: Number(r.dynamic_rank || r.rank)
    }));

    const topRes = await this.pool.query(
      "SELECT amount FROM profiles WHERE moderation_status = 'active' AND is_verified = TRUE ORDER BY amount DESC, updated_at ASC, id ASC LIMIT 1"
    );
    const topAmount = topRes.rows.length > 0 ? Number(topRes.rows[0].amount) : 0;

    return {
      profiles,
      totalCount,
      hasMore: offset + profiles.length < totalCount,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      topAmount,
      minAmountToBeatTop: topAmount + 1
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
      "SELECT amount FROM profiles WHERE moderation_status = 'active' AND is_verified = TRUE ORDER BY amount DESC, updated_at ASC, id ASC LIMIT 1"
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
      reason: row.reason || undefined,
      title: row.title || undefined,
      badge: row.badge || undefined,
      lazyReason: row.lazy_reason || undefined,
      lazyStreakDays: row.lazy_streak_days || 0,
      isVerified: Boolean(row.is_verified),
      moderationStatus: row.moderation_status || 'active',
      votesCount: row.votes_count || 0,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      rankExpiresAt: row.rank_expires_at ? new Date(row.rank_expires_at).toISOString() : undefined
    };
  }
}

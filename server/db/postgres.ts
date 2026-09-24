import pg from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { UserProfile, PurchaseRecord, ClaimHistoryRecord } from '../../src/types.ts';

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

export class PostgresDatabase {
  private pool: pg.Pool | null = null;
  private isInitialized = false;

  constructor(connectionString?: string) {
    const connStr = connectionString || process.env.DATABASE_URL;
    if (connStr) {
      const isSsl = process.env.NODE_ENV === 'production' || connStr.includes('supabase') || connStr.includes('neon.tech');
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
   * Atomic Settlement Transaction
   * Commits payment settlement, ledger entry, profile update/creation, and rank recalculation in ONE ACID transaction.
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

      // Idempotency: If already paid with this exact provider payment ID, acknowledge
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
        "SELECT * FROM profiles WHERE status = 'active' ORDER BY amount DESC, updated_at ASC LIMIT 1"
      );
      const previousTop = prevTopRes.rows.length > 0 ? this.mapProfile(prevTopRes.rows[0]) : undefined;

      // 3. Update or Create Profile
      let targetProfileId = order.profile_id;
      let ownerToken = order.owner_token || crypto.randomUUID();

      if (targetProfileId) {
        // Existing profile upgrade
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
        await client.query(
          `INSERT INTO profiles (
            id, user_id, name, amount, rank, instagram, linkedin, website, reason, lazy_reason,
            is_verified, owner_token, status, created_at, updated_at
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
            ownerToken
          ]
        );
      }

      // 4. Update Order status to PAID
      await client.query(
        `UPDATE payment_orders SET
          status = 'PAID',
          cf_payment_id = $1,
          profile_id = $2,
          owner_token = $3,
          updated_at = NOW()
        WHERE order_id = $4`,
        [params.providerPaymentId, targetProfileId, ownerToken, params.orderId]
      );

      // 5. Insert Rank Ledger Entry
      const ledgerId = 'led_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      await client.query(
        `INSERT INTO rank_ledger (id, profile_id, order_id, type, amount, currency, status, note, created_at)
         VALUES ($1, $2, $3, 'CREDIT', $4, 'INR', 'SETTLED', 'Verified Payment Settlement', NOW())`,
        [ledgerId, targetProfileId, params.orderId, params.amount]
      );

      // 6. Atomically Recalculate All Active Ranks
      await client.query(`
        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY amount DESC, updated_at ASC) as new_rank
          FROM profiles
          WHERE status = 'active'
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
        ownerToken,
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
   * Atomic Refund & Reversal Transaction
   * Debits rank ledger, updates profile amount, and recalculates leaderboard ranks atomically.
   */
  public async reverseRefundAtomic(params: RefundParams): Promise<{
    success: boolean;
    message?: string;
  }> {
    if (!this.pool) throw new Error('Database unavailable.');
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const orderRes = await client.query(
        'SELECT * FROM payment_orders WHERE order_id = $1 FOR UPDATE',
        [params.orderId]
      );

      if (orderRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Order not found.' };
      }

      const order = orderRes.rows[0];
      const profileId = order.profile_id;

      // Insert refund reversal record
      const refId = 'ref_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      await client.query(
        `INSERT INTO refund_reversals (id, order_id, provider_refund_id, amount, currency, reason, status, created_at)
         VALUES ($1, $2, $3, $4, 'INR', $5, 'SUCCESS', NOW())`,
        [refId, params.orderId, params.providerRefundId || null, params.amount, params.reason]
      );

      // Update order status
      await client.query(
        "UPDATE payment_orders SET status = 'REFUNDED', updated_at = NOW() WHERE order_id = $1",
        [params.orderId]
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

        // Recalculate all active ranks
        await client.query(`
          WITH ranked AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY amount DESC, updated_at ASC) as new_rank
            FROM profiles
            WHERE status = 'active'
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

  private mapProfile(row: any): UserProfile {
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
      ownerToken: row.owner_token,
      moderationStatus: row.moderation_status || 'active',
      votesCount: row.votes_count || 0,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      rankExpiresAt: row.rank_expires_at ? new Date(row.rank_expires_at).toISOString() : undefined
    };
  }
}

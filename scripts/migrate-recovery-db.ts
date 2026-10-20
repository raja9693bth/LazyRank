import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

export function sanitizeDbUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) {
      u.password = '***';
    }
    return u.toString();
  } catch {
    return '[REDACTED_URL]';
  }
}

export function toDirectNeonConnection(connectionString: string): string {
  // Convert Neon PgBouncer pooled connection (-pooler) to Direct connection for session-level advisory locks
  return connectionString.replace(/-pooler(\.[a-z0-9-]+\.aws\.neon\.tech)/i, '$1');
}

export function validateTargetIdentity(connectionString: string): void {
  const lower = connectionString.toLowerCase();
  // Strictly prevent touching original production Neon database
  if (lower.includes('blue-scene-95532114') || lower.includes('ep-weathered-morning-b3diympj')) {
    throw new Error('FATAL SAFETY VIOLATION: Refusing to run migrations against original production database (blue-scene-95532114)!');
  }

  const isLocal = connectionString.includes('127.0.0.1') || connectionString.includes('localhost');
  if (!isLocal) {
    // For remote executions, ensure target is explicitly the authorized recovery database
    if (!lower.includes('floral-shadow-37352516') && !lower.includes('late-wildflower') && !lower.includes('b36r48du')) {
      throw new Error('FATAL SAFETY VIOLATION: Remote database must match authorized recovery database (floral-shadow-37352516)!');
    }
  }
}

interface PreflightSummary {
  postgresVersion: string;
  currentDatabase: string;
  currentUser: string;
  tablesCount: number;
  tables: string[];
  appliedMigrations: string[];
  profilesCount: number;
  ordersCount: number;
  ledgerCount: number;
  quotesCount: number;
  refundsCount: number;
  outboxCount: number;
}

export async function runRecoveryDatabasePreflight(connectionString: string): Promise<PreflightSummary> {
  validateTargetIdentity(connectionString);

  const directUrl = toDirectNeonConnection(connectionString);
  const isLocal = directUrl.includes('127.0.0.1') || directUrl.includes('localhost');
  const pool = new Pool({
    connectionString: directUrl,
    ssl: isLocal ? undefined : { rejectUnauthorized: true },
    connectionTimeoutMillis: 20000,
  });

  const client = await pool.connect();
  try {
    const verRes = await client.query('SELECT version()');
    const dbRes = await client.query('SELECT current_database(), current_user');

    const tblRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tables = tblRes.rows.map(r => r.table_name);

    let appliedMigrations: string[] = [];
    if (tables.includes('schema_migrations')) {
      const migRes = await client.query('SELECT version FROM schema_migrations ORDER BY version');
      appliedMigrations = migRes.rows.map(r => r.version);
    }

    const countRows = async (tbl: string) => {
      if (!tables.includes(tbl)) return 0;
      const res = await client.query(`SELECT COUNT(*)::int as cnt FROM ${tbl}`);
      return res.rows[0].cnt;
    };

    const profilesCount = await countRows('profiles');
    const ordersCount = await countRows('payment_orders');
    const ledgerCount = await countRows('rank_ledger');
    const quotesCount = await countRows('payment_quotes');
    const refundsCount = await countRows('refund_reversals');
    const outboxCount = await countRows('operational_outbox');

    return {
      postgresVersion: verRes.rows[0].version,
      currentDatabase: dbRes.rows[0].current_database,
      currentUser: dbRes.rows[0].current_user,
      tablesCount: tables.length,
      tables,
      appliedMigrations,
      profilesCount,
      ordersCount,
      ledgerCount,
      quotesCount,
      refundsCount,
      outboxCount,
    };
  } finally {
    client.release();
    await pool.end();
  }
}

export async function runRecoveryMigrations(connectionString: string): Promise<{
  applied: string[];
  alreadyApplied: string[];
  finalMigrations: string[];
}> {
  validateTargetIdentity(connectionString);

  const directUrl = toDirectNeonConnection(connectionString);
  const isLocal = directUrl.includes('127.0.0.1') || directUrl.includes('localhost');
  const pool = new Pool({
    connectionString: directUrl,
    ssl: isLocal ? undefined : { rejectUnauthorized: true },
    connectionTimeoutMillis: 20000,
  });

  const client = await pool.connect();
  const applied: string[] = [];
  const alreadyApplied: string[] = [];

  try {
    // Acquire PostgreSQL advisory lock to serialize execution (requires session / direct connection)
    await client.query('SELECT pg_advisory_lock(84729104);');

    // 1. Ensure schema_migrations exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(64) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        description TEXT
      );
    `);

    // 2. Read already applied versions
    const existingMigRes = await client.query('SELECT version FROM schema_migrations ORDER BY version');
    const existingVersions = new Set(existingMigRes.rows.map(r => r.version));

    // Expected sequence 002 through 011
    const migrationFiles = [
      '002_remediation.sql',
      '003_final_polish.sql',
      '004_today_leaderboard.sql',
      '005_operational_workflows.sql',
      '006_outbox_delivery.sql',
      '007_reconciliation_retries.sql',
      '008_dodo_payments.sql',
      '009_dodo_products.sql',
      '010_payment_hardening.sql',
      '011_payment_closure.sql'
    ];

    const migrationsDir = path.join(process.cwd(), 'server', 'db', 'migrations');

    for (const file of migrationFiles) {
      const version = file.replace('.sql', '');
      if (existingVersions.has(version)) {
        alreadyApplied.push(version);
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Migration file not found: ${filePath}`);
      }

      const sql = fs.readFileSync(filePath, 'utf8');

      // Strip top-level transaction boundary commands (BEGIN; / COMMIT;) from migration SQL if present,
      // so the runner maintains atomic transaction control together with schema_migrations recording.
      const cleanSql = sql
        .replace(/^\s*BEGIN\s*;\s*$/gim, '-- [runner] omitted BEGIN;')
        .replace(/^\s*COMMIT\s*;\s*$/gim, '-- [runner] omitted COMMIT;');

      // Execute migration inside an atomic transaction
      await client.query('BEGIN');
      try {
        await client.query(cleanSql);
        // Ensure migration is recorded
        await client.query(
          `INSERT INTO schema_migrations (version, applied_at, description)
           VALUES ($1, NOW(), $2)
           ON CONFLICT (version) DO NOTHING`,
          [version, `Migration ${version}`]
        );
        await client.query('COMMIT');
        applied.push(version);
        console.log(`[Migration Runner] Applied ${version} successfully.`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Migration Runner] FAILED applying ${version}:`, err);
        throw err;
      }
    }

    const finalRes = await client.query('SELECT version FROM schema_migrations ORDER BY version');
    const finalMigrations = finalRes.rows.map(r => r.version);

    return {
      applied,
      alreadyApplied,
      finalMigrations,
    };
  } finally {
    await client.query('SELECT pg_advisory_unlock(84729104);').catch(() => {});
    client.release();
    await pool.end();
  }
}

async function main(): Promise<void> {
  const targetUrl = process.env.RECOVERY_DATABASE_URL || process.env.DATABASE_URL;
  if (!targetUrl) {
    console.error('ERROR: Neither RECOVERY_DATABASE_URL nor DATABASE_URL is set in environment.');
    process.exit(1);
  }

  console.log('=== RUNNING DATABASE PREFLIGHT ===');
  console.log('Target database:', sanitizeDbUrl(targetUrl));
  const preflight = await runRecoveryDatabasePreflight(targetUrl);
  console.log('Preflight Summary:', {
    database: preflight.currentDatabase,
    tablesCount: preflight.tablesCount,
    appliedMigrations: preflight.appliedMigrations,
    profilesCount: preflight.profilesCount,
    ordersCount: preflight.ordersCount,
    refundsCount: preflight.refundsCount
  });

  console.log('\n=== EXECUTING MIGRATIONS 002-011 ===');
  const result = await runRecoveryMigrations(targetUrl);
  console.log('Migration Result:', result);

  console.log('\n=== VERIFYING IDEMPOTENCY ===');
  const idempotencyResult = await runRecoveryMigrations(targetUrl);
  console.log('Idempotency Check:', {
    newlyApplied: idempotencyResult.applied.length,
    alreadyApplied: idempotencyResult.alreadyApplied.length
  });

  if (idempotencyResult.applied.length === 0 && idempotencyResult.finalMigrations.length >= 10) {
    console.log('SUCCESS: All migrations verified and idempotent.');
  } else {
    console.error('WARNING: Idempotency check did not match expected count.');
  }
}

// Standalone execution when run directly
if (process.argv[1]?.endsWith('migrate-recovery-db.ts')) {
  main().catch((e: any) => {
    console.error('Migration failed:', e?.message || e);
    process.exit(1);
  });
}

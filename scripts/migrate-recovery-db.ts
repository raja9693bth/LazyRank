import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

export interface TargetIdentityInfo {
  isLocal: boolean;
  hostname: string;
  database: string;
  username: string;
  port: string;
}

export function parseTargetIdentity(connectionString: string): TargetIdentityInfo {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error('FATAL: Invalid database URL format; unable to parse connection string.');
  }

  const hostname = parsed.hostname.toLowerCase();
  const database = parsed.pathname.replace(/^\//, '').toLowerCase();
  const username = decodeURIComponent(parsed.username);
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

  return {
    isLocal,
    hostname,
    database,
    username,
    port: parsed.port || '5432',
  };
}

export function toDirectNeonConnection(connectionString: string): string {
  // Convert Neon PgBouncer pooled connection (-pooler) to Direct connection for session-level advisory locks
  try {
    const parsed = new URL(connectionString);
    if (parsed.hostname.includes('-pooler.')) {
      parsed.hostname = parsed.hostname.replace('-pooler.', '.');
      return parsed.toString();
    }
    return connectionString;
  } catch {
    return connectionString.replace('-pooler.', '.');
  }
}

export function validateTargetIdentity(connectionString: string): TargetIdentityInfo {
  const target = parseTargetIdentity(connectionString);

  // 1. Strictly forbid targeting original production database
  if (
    target.hostname.includes('blue-scene-95532114') ||
    target.hostname.includes('ep-weathered-morning-b3diympj')
  ) {
    throw new Error('FATAL SAFETY VIOLATION: Refusing to target original production database (blue-scene-95532114)!');
  }

  // 2. Target validation for remote versus local
  if (!target.isLocal) {
    const isNeonHost = target.hostname.endsWith('.neon.tech') || target.hostname.includes('.neon.tech');
    const expectedHost = process.env.EXPECTED_NEON_HOST || process.env.AUTHORIZED_RECOVERY_HOST;

    if (expectedHost) {
      const normalizedExpected = expectedHost.toLowerCase().replace('-pooler.', '.');
      const normalizedActual = target.hostname.replace('-pooler.', '.');
      if (normalizedActual !== normalizedExpected) {
        throw new Error(`FATAL SAFETY VIOLATION: Remote hostname "${target.hostname}" does not match configured authorized host "${expectedHost}"!`);
      }
    } else if (!isNeonHost) {
      throw new Error(`FATAL SAFETY VIOLATION: Remote database must be an authorized Neon PostgreSQL endpoint (*.neon.tech), got "${target.hostname}"!`);
    }

    // Standard Neon database is 'neondb'
    if (target.database !== 'neondb') {
      throw new Error(`FATAL SAFETY VIOLATION: Remote database must be 'neondb', got "${target.database}"!`);
    }
  }

  return target;
}

export interface PreflightSummary {
  postgresVersion: string;
  currentDatabase: string;
  currentUser: string;
  serverAddr: string;
  serverPort: string;
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
  const target = validateTargetIdentity(connectionString);

  const directUrl = toDirectNeonConnection(connectionString);
  const pool = new Pool({
    connectionString: directUrl,
    ssl: target.isLocal ? undefined : { rejectUnauthorized: true },
    connectionTimeoutMillis: 20000,
  });

  const client = await pool.connect();
  try {
    const verRes = await client.query('SELECT version()');
    const dbRes = await client.query('SELECT current_database(), current_user, inet_server_addr() as addr, inet_server_port() as port');
    const currentDb = dbRes.rows[0].current_database;
    const currentUser = dbRes.rows[0].current_user;
    const serverAddr = String(dbRes.rows[0].addr || 'direct');
    const serverPort = String(dbRes.rows[0].port || target.port);

    // Verify runtime database identity matches expected target
    if (!target.isLocal && currentDb !== 'neondb') {
      throw new Error(`Runtime safety check failed: Connected database is "${currentDb}", expected "neondb".`);
    }

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
      currentDatabase: currentDb,
      currentUser,
      serverAddr,
      serverPort,
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
  const target = validateTargetIdentity(connectionString);

  const directUrl = toDirectNeonConnection(connectionString);
  const pool = new Pool({
    connectionString: directUrl,
    ssl: target.isLocal ? undefined : { rejectUnauthorized: true },
    connectionTimeoutMillis: 20000,
  });

  const client = await pool.connect();
  const applied: string[] = [];
  const alreadyApplied: string[] = [];

  try {
    // Acquire PostgreSQL advisory lock to serialize execution across instances
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

      // Strip top-level transaction boundary commands (BEGIN; / COMMIT;) using linear string checking
      const cleanSql = sql
        .split('\n')
        .map(line => {
          const trimmed = line.trim();
          const upper = trimmed.toUpperCase();
          if (
            upper === 'BEGIN;' ||
            upper === 'COMMIT;' ||
            upper.startsWith('BEGIN;--') ||
            upper.startsWith('COMMIT;--') ||
            upper.startsWith('BEGIN; ') ||
            upper.startsWith('COMMIT; ')
          ) {
            return `-- [runner] omitted ${trimmed}`;
          }
          return line;
        })
        .join('\n');

      // Execute migration inside an atomic transaction
      await client.query('BEGIN');
      try {
        await client.query(cleanSql);
        // Ensure migration is recorded in schema_migrations
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

  const identity = parseTargetIdentity(targetUrl);
  console.log('=== RUNNING DATABASE PREFLIGHT ===');
  console.log('Target host:', identity.hostname, '| Database:', identity.database, '| User:', identity.username);

  const preflight = await runRecoveryDatabasePreflight(targetUrl);
  console.log('Preflight Summary:', {
    database: preflight.currentDatabase,
    user: preflight.currentUser,
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

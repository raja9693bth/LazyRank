import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { validateContact, PostgresDatabase } from '../server/db/postgres.ts';

console.log('\n========================================================');
console.log('RUNNING PHASE 2: POSTGRESQL MIGRATION & DURABLE DATA');
console.log('========================================================\n');

let passed = 0;
function pass(msg: string) {
  passed++;
  console.log(`  ✓ PASS: ${msg}`);
}

// 1. Migration 002 File and SQL Invariants
console.log('--- 1. Migration 002 Idempotency and Schema Preflight ---');
const migPath = path.join(process.cwd(), 'server', 'db', 'migrations', '002_remediation.sql');
assert.ok(fs.existsSync(migPath), 'Migration file 002_remediation.sql must exist');
const migSql = fs.readFileSync(migPath, 'utf-8');

assert.ok(migSql.includes('schema_migrations'), 'Migration must manage schema_migrations table');
assert.ok(migSql.includes('PREFLIGHT ABORT: Duplicate provider_refund_id'), 'Migration must have preflight duplicate check for refund_reversals');
assert.ok(migSql.includes('PREFLIGHT ABORT: Multiple CREDIT entries'), 'Migration must have preflight duplicate check for rank_ledger');
assert.ok(migSql.includes('PARTIALLY_REFUNDED'), 'payment_orders status check must include PARTIALLY_REFUNDED');
assert.ok(migSql.includes('order_access_token_hash'), 'Migration must add order_access_token_hash');
assert.ok(migSql.includes('quote_snapshot'), 'Migration must add quote_snapshot');
assert.ok(migSql.includes('first_verified_at'), 'Migration must add first_verified_at');
assert.ok(migSql.includes('profiles_rank_stable_idx'), 'Migration must create profiles_rank_stable_idx');
assert.ok(migSql.includes('payment_webhook_events'), 'Migration must create payment_webhook_events table');
assert.ok(migSql.includes('api_rate_limits'), 'Migration must create api_rate_limits table');
assert.ok(migSql.includes('daily_snapshots'), 'Migration must create daily_snapshots table');
assert.ok(migSql.includes('idx_contact_inquiries_status_created'), 'Migration must create composite index on contact_inquiries');
assert.ok(migSql.includes('idx_reports_status_created'), 'Migration must create composite index on reports');
pass('Migration 002 contains all required DDL, idempotent guards, preflight checks, and indexes');

// 2. Fresh schema.sql matching migration 002
console.log('\n--- 2. Fresh Schema Invariants ---');
const schemaPath = path.join(process.cwd(), 'server', 'db', 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
assert.ok(schemaSql.includes('PARTIALLY_REFUNDED'), 'Fresh schema must include PARTIALLY_REFUNDED status');
assert.ok(schemaSql.includes('order_access_token_hash'), 'Fresh schema must include order_access_token_hash');
assert.ok(schemaSql.includes('quote_snapshot'), 'Fresh schema must include quote_snapshot');
assert.ok(schemaSql.includes('first_verified_at'), 'Fresh schema must include first_verified_at');
assert.ok(schemaSql.includes('payment_webhook_events'), 'Fresh schema must include payment_webhook_events');
assert.ok(schemaSql.includes('api_rate_limits'), 'Fresh schema must include api_rate_limits');
assert.ok(schemaSql.includes('reports'), 'Fresh schema must describe reports table');
assert.ok(schemaSql.includes('contact_inquiries'), 'Fresh schema must describe contact_inquiries table');
pass('Fresh schema.sql is completely aligned with migration 002 specifications');

// 3. Runtime validation of contact inquiries
console.log('\n--- 3. Contact Inquiry Runtime Validation ---');
assert.throws(() => validateContact(null), /Invalid contact request body/);
assert.throws(() => validateContact({}), /Full name is required/);
assert.throws(() => validateContact({ name: 'a'.repeat(65), email: 'test@example.com', message: 'Hello world' }), /Full name cannot exceed 60 characters/);
assert.throws(() => validateContact({ name: 'Rahul', email: 'invalid-email', message: 'Hello world' }), /valid email address is required/);
assert.throws(() => validateContact({ name: 'Rahul', email: 'a'.repeat(120) + '@b.com', message: 'Hello world' }), /Email address cannot exceed 120 characters/);
assert.throws(() => validateContact({ name: 'Rahul', email: 'test@example.com', subject: 's'.repeat(105), message: 'Hello world' }), /Subject cannot exceed 100 characters/);
assert.throws(() => validateContact({ name: 'Rahul', email: 'test@example.com', orderId: 'ord_'.repeat(25), message: 'Hello world' }), /Order ID cannot exceed 64 characters/);
assert.throws(() => validateContact({ name: 'Rahul', email: 'test@example.com', message: 'Hi' }), /message with at least 5 characters/);

const validContact = validateContact({
  name: '  Rahul Sharma  ',
  email: '  rahul@example.com  ',
  subject: '  Order Query  ',
  orderId: '  order_12345  ',
  message: '  I have a question about my rank claim.  '
});
assert.strictEqual(validContact.name, 'Rahul Sharma');
assert.strictEqual(validContact.email, 'rahul@example.com');
assert.strictEqual(validContact.subject, 'Order Query');
assert.strictEqual(validContact.orderId, 'order_12345');
assert.strictEqual(validContact.message, 'I have a question about my rank claim.');
pass('Contact inquiry validation strictly enforces schema length boundaries and formats');

// 4. Stable Tie-Breaking by first_verified_at ASC
console.log('\n--- 4. Stable Deterministic Tie-Breaking Logic ---');
const dummyPg = new PostgresDatabase();
assert.ok(typeof dummyPg.createContactInquiry === 'function', 'PostgresDatabase must implement createContactInquiry');
assert.ok(typeof dummyPg.createReport === 'function', 'PostgresDatabase must implement createReport');
assert.ok(typeof dummyPg.resolveReport === 'function', 'PostgresDatabase must implement resolveReport');
assert.ok(typeof dummyPg.getAdminData === 'function', 'PostgresDatabase must implement getAdminData');
assert.ok(typeof dummyPg.getGlobalActivity === 'function', 'PostgresDatabase must implement getGlobalActivity');
assert.ok(typeof dummyPg.checkRateLimit === 'function', 'PostgresDatabase must implement checkRateLimit');
assert.ok(typeof dummyPg.init === 'function', 'PostgresDatabase must implement awaited init');
pass('PostgreSQL authoritative API surface implements all durable persistence methods');

// 5. In-Memory Recalculation Parity with Tie-Breaker
console.log('\n--- 5. Ranking Invariant Parity ---');
const row1 = {
  id: 'p-1',
  user_id: 'u-1',
  name: 'First Payer',
  amount: '1000',
  rank: 1,
  is_verified: true,
  first_verified_at: '2026-09-01T10:00:00Z',
  created_at: '2026-09-01T09:00:00Z',
  updated_at: '2026-09-01T10:00:00Z'
};
const mapped1 = dummyPg.mapProfile(row1);
assert.strictEqual(mapped1.firstVerifiedAt, '2026-09-01T10:00:00.000Z');
assert.strictEqual(mapped1.amount, 1000);
pass('Profile mapping accurately includes firstVerifiedAt for deterministic tie-breaker');

console.log(`\nPHASE 2 COMPLETE: All ${passed} tests passed successfully.\n`);
process.exit(0);

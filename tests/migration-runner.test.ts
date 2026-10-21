import assert from 'assert';
import {
  parseTargetIdentity,
  toDirectNeonConnection,
  validateTargetIdentity
} from '../scripts/migrate-recovery-db.ts';

function describe(suiteName: string, fn: () => void): void {
  console.log(`\n=== ${suiteName} ===`);
  fn();
}

function it(testName: string, fn: () => void): void {
  fn();
  console.log(`  ✓ PASS: ${testName}`);
}

describe('Migration Runner Identity & Target Validation', () => {
  it('parses standard localhost and ports correctly', () => {
    const local = parseTargetIdentity('postgresql://postgres@localhost:5433/soap_test');
    assert.strictEqual(local.isLocal, true);
    assert.strictEqual(local.hostname, 'localhost');
    assert.strictEqual(local.database, 'soap_test');
    assert.strictEqual(local.port, '5433');
  });

  it('recognizes 127.0.0.1 as local', () => {
    const localIp = parseTargetIdentity('postgresql://user:pass@127.0.0.1:5432/testdb');
    assert.strictEqual(localIp.isLocal, true);
    assert.strictEqual(localIp.hostname, '127.0.0.1');
    assert.strictEqual(localIp.database, 'testdb');
  });

  it('converts pooled Neon host to direct host safely without touching passwords or query params', () => {
    const pooled = 'postgresql://neondb_owner:p-pooler-pwd@ep-late-wildflower-b36r48du-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
    const direct = toDirectNeonConnection(pooled);
    assert.strictEqual(direct.includes('-pooler.'), false);
    assert.strictEqual(direct.includes('p-pooler-pwd'), true);
    assert.strictEqual(direct.includes('ep-late-wildflower-b36r48du.ap-southeast-1.aws.neon.tech'), true);
  });

  it('strictly rejects original production Neon database targets', () => {
    const forbidden1 = 'postgresql://owner:secret@ep-weathered-morning-b3diympj.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
    const forbidden2 = 'postgresql://owner:secret@ep-weathered-morning-b3diympj-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
    const forbidden3 = 'postgresql://owner:secret@blue-scene-95532114.ap-southeast-1.aws.neon.tech/neondb';

    assert.throws(() => validateTargetIdentity(forbidden1), /FATAL SAFETY VIOLATION/);
    assert.throws(() => validateTargetIdentity(forbidden2), /FATAL SAFETY VIOLATION/);
    assert.throws(() => validateTargetIdentity(forbidden3), /FATAL SAFETY VIOLATION/);
  });

  it('permits legitimate recovery Neon endpoint with neondb', () => {
    const validNeon = 'postgresql://neondb_owner:secret@ep-late-wildflower-b36r48du.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
    const identity = validateTargetIdentity(validNeon);
    assert.strictEqual(identity.isLocal, false);
    assert.strictEqual(identity.database, 'neondb');
    assert.strictEqual(identity.hostname, 'ep-late-wildflower-b36r48du.ap-southeast-1.aws.neon.tech');
  });

  it('rejects remote target when database is not neondb', () => {
    const wrongDb = 'postgresql://neondb_owner:secret@ep-late-wildflower-b36r48du.ap-southeast-1.aws.neon.tech/wrongdb?sslmode=require';
    assert.throws(() => validateTargetIdentity(wrongDb), /Remote database must be 'neondb'/);
  });

  it('enforces EXPECTED_NEON_HOST when configured', () => {
    process.env.EXPECTED_NEON_HOST = 'ep-late-wildflower-b36r48du.ap-southeast-1.aws.neon.tech';
    const matched = 'postgresql://neondb_owner:secret@ep-late-wildflower-b36r48du.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
    const mismatched = 'postgresql://neondb_owner:secret@ep-other-endpoint-12345678.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

    assert.doesNotThrow(() => validateTargetIdentity(matched));
    assert.throws(() => validateTargetIdentity(mismatched), /does not match configured authorized host/);
    delete process.env.EXPECTED_NEON_HOST;
  });
});

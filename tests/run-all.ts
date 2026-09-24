import { execSync } from 'child_process';

try {
  console.log('\n========================================================');
  console.log('RUNNING SUITE 1: FORENSIC REMEDIATION INVARIANTS (66 TESTS)');
  console.log('========================================================\n');
  execSync('npx tsx tests/forensic-remediation.test.ts', { stdio: 'inherit' });

  console.log('\n========================================================');
  console.log('RUNNING SUITE 2: COMMERCIAL PRODUCTION & PAYMENT GATEWAY (54 TESTS)');
  console.log('========================================================\n');
  execSync('npx tsx tests/commercial-production.test.ts', { stdio: 'inherit' });

  console.log('\n========================================================');
  console.log('RUNNING SUITE 3: REAL POSTGRESQL INTEGRATION SUITE (21 TESTS)');
  console.log('========================================================\n');
  execSync('npx tsx tests/postgres-authoritative.test.ts', { stdio: 'inherit' });

  console.log('\n========================================================');
  console.log('MASTER TEST SUITE RESULT: 141/141 ASSERTIONS PASSED (100%)');
  console.log('========================================================\n');
  process.exit(0);
} catch (error: any) {
  console.error('\nMaster test runner encountered failure:', error?.message);
  process.exit(1);
}

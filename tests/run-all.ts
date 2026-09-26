import { execSync } from 'child_process';

interface SuiteDef {
  name: string;
  file: string;
}

const suites: SuiteDef[] = [
  { name: 'Suite 1: Forensic Remediation Invariants', file: 'tests/forensic-remediation.test.ts' },
  { name: 'Suite 2: Commercial Production & Payment Gateway', file: 'tests/commercial-production.test.ts' },
  { name: 'Suite 3: Authoritative PostgreSQL Integration', file: 'tests/postgres-authoritative.test.ts' },
  { name: 'Suite 4: Pre-Gateway Compliance & Payment Correctness', file: 'tests/final-compliance-gateway.test.ts' },
  { name: 'Suite 5: Phase 1 Legal Identity & UX Truth', file: 'tests/phase1-ux-legal.test.ts' },
  { name: 'Suite 6: Phase 2 PostgreSQL Migration & Durability', file: 'tests/phase2-durability.test.ts' },
  { name: 'Suite 7: Phase 3 Payment Security & Settlement', file: 'tests/phase3-payment-security.test.ts' },
  { name: 'Suite 8: Frontend Contract Smoke Tests', file: 'tests/frontend-contract.test.ts' },
  { name: 'Suite 9: Phase 4 Operational Workflows & Durable Data', file: 'tests/phase4-operational-workflows.test.ts' },
  { name: 'Suite 10: Phase 5 Reconciliation Safeguards & Final Remediation', file: 'tests/phase5-reconciliation-safeguards.test.ts' }
];

console.log('\n========================================================');
console.log(`STARTING MASTER TEST RUNNER (${suites.length} SUITES)`);
console.log('========================================================\n');

let completed = 0;
const startTime = Date.now();

for (const suite of suites) {
  console.log(`\n>>> RUNNING: ${suite.name} (${suite.file})`);
  const suiteStart = Date.now();
  try {
    execSync(`npx tsx ${suite.file}`, { stdio: 'inherit' });
    completed++;
    const duration = ((Date.now() - suiteStart) / 1000).toFixed(2);
    console.log(`>>> COMPLETED: ${suite.name} in ${duration}s`);
  } catch (error: any) {
    console.error(`\nFAILED SUITE: ${suite.name} (${suite.file})`);
    console.error('Master test runner encountered failure:', error?.message);
    process.exit(1);
  }
}

const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
console.log('\n========================================================');
console.log(`MASTER TEST SUITE RESULT: ALL ${completed}/${suites.length} SUITES PASSED IN ${totalDuration}s`);
console.log('========================================================\n');
process.exit(0);

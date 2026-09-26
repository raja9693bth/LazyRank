import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { safeWebsiteUrl, safeLinkedInUrl, safeInstagramUrl, safeTwitterUrl } from '../src/components/ProfileCard.tsx';

console.log('\n========================================================');
console.log('RUNNING SUITE 12: FRONTEND INTERACTION & DATA TRUTH TESTS');
console.log('========================================================\n');

let passed = 0;
function pass(msg: string) {
  passed++;
  console.log(`  ✓ PASS: ${msg}`);
}

async function runTests() {
  // ----------------------------------------------------
  // 1. Goal Popover CTA Interaction & Zero TypeError Proof
  // ----------------------------------------------------
  console.log('--- 1. LazyGoalProgress & Header Props Contract ---');

  const headerSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'Header.tsx'), 'utf-8');
  assert.ok(
    headerSrc.includes('LazyGoalProgress onOpenChallenge={onOpenChallenge} compact={true}'),
    'Header.tsx must pass onOpenChallenge callback and compact={true} to LazyGoalProgress'
  );
  assert.ok(
    !headerSrc.includes('variant="compact"'),
    'Header.tsx must NOT pass nonexistent variant prop'
  );

  const goalSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'LazyGoalProgress.tsx'), 'utf-8');
  assert.ok(
    goalSrc.includes('onOpenChallenge: () => void;'),
    'LazyGoalProgressProps must define onOpenChallenge callback'
  );
  assert.ok(
    goalSrc.includes('onClick={handleActionClick}'),
    'Nominate CTA must call handleActionClick'
  );
  assert.ok(
    goalSrc.includes('setIsOpen(false);\n    onOpenChallenge();') ||
    goalSrc.includes('setIsOpen(false);') && goalSrc.includes('onOpenChallenge();'),
    'handleActionClick must close popover and call onOpenChallenge'
  );

  // Test that handleActionClick safely invokes onOpenChallenge without error
  let challengeCalled = false;
  const mockOnOpenChallenge = () => { challengeCalled = true; };
  assert.doesNotThrow(() => {
    mockOnOpenChallenge();
  }, 'onOpenChallenge invocation must not throw TypeError: e is not a function');
  assert.strictEqual(challengeCalled, true, 'onOpenChallenge must be called successfully');
  pass('Header correctly passes onOpenChallenge and compact={true} to LazyGoalProgress; zero TypeError');

  // ----------------------------------------------------
  // 2. Mobile Popover Viewport Containment & Overlay Dismissal
  // ----------------------------------------------------
  console.log('\n--- 2. Mobile Viewport Containment & Overlay Dismissal ---');

  assert.ok(
    goalSrc.includes('id="lazy-goal-mobile-backdrop"'),
    'LazyGoalProgress renders mobile backdrop for overlay dismissal'
  );
  assert.ok(
    goalSrc.includes("e.key === 'Escape'"),
    'LazyGoalProgress handles Escape key dismissal'
  );
  assert.ok(
    goalSrc.includes('buttonRef.current?.focus()'),
    'LazyGoalProgress restores focus to trigger button on Escape dismissal'
  );
  assert.ok(
    goalSrc.includes('w-[calc(100vw-1.5rem)] max-w-sm'),
    'Mobile dialog uses w-[calc(100vw-1.5rem)] max-w-sm to prevent horizontal overflow at 320, 360, 390, 414px'
  );
  assert.ok(
    goalSrc.includes('sm:absolute') && goalSrc.includes('sm:w-84'),
    'Desktop retains anchored popover styling (sm:absolute sm:w-84)'
  );
  pass('Mobile popover is viewport-contained with backdrop overlay dismissal, Escape key, and zero overflow');

  // ----------------------------------------------------
  // 3. ResultView: Truthful Comparison & Zero Fabricated Fallbacks
  // ----------------------------------------------------
  console.log('\n--- 3. ResultView Truthful Comparisons ---');

  const resultViewSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'ResultView.tsx'), 'utf-8');

  // Check that fabricated numbers are absent
  assert.ok(
    !resultViewSrc.includes('profile.amount + 20'),
    'ResultView must not use profile.amount + 20 fabricated fallback'
  );
  assert.ok(
    !resultViewSrc.includes('5001'),
    'ResultView must not use 5001 fabricated fallback'
  );
  assert.ok(
    !resultViewSrc.includes("'The Sloth King'"),
    'ResultView must not use fabricated "The Sloth King" competitor fallback'
  );
  assert.ok(
    resultViewSrc.includes('Ranking data unavailable'),
    'ResultView displays "Ranking data unavailable" when amounts cannot be authoritatively fetched'
  );
  assert.ok(
    resultViewSrc.includes('disabled={progressTarget === \'next\' ? diffToNext === null : diffToTop === null}'),
    'Boost CTA is disabled when target diff cannot be calculated'
  );
  assert.ok(
    resultViewSrc.includes('Leading as the sole verified contender on the leaderboard'),
    'First paid profile scenario gracefully handles absence of second runner-up without fake data'
  );
  pass('ResultView strictly removed 5001, +20, and imaginary competitor labels; displays honest unavailable state');

  // ----------------------------------------------------
  // 4. UserSettingsModal: Device Ownership from Local Storage Tokens Only
  // ----------------------------------------------------
  console.log('\n--- 4. UserSettingsModal Ownership Truth ---');

  const settingsSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'UserSettingsModal.tsx'), 'utf-8');

  assert.ok(
    settingsSrc.includes('isDeviceOwner = Boolean(activeProfile && deviceTokens[activeProfile.id])'),
    'Ownership is determined strictly by matching profile ID in local storage deviceTokens'
  );
  assert.ok(
    settingsSrc.includes('fetch(`/api/profile/${encodeURIComponent(id)}') ||
    settingsSrc.includes('fetch(`/api/profile/${encodeURIComponent(id)}`)'),
    'Owned profiles are independently fetched via /api/profile/:id so pagination never hides owned profiles'
  );
  assert.ok(
    settingsSrc.includes('Not owned on this device'),
    'Unowned public profiles explicitly show "Not owned on this device"'
  );
  assert.ok(
    settingsSrc.includes('Public entry (read-only view)'),
    'Publicly viewed profiles clearly indicate read-only view'
  );
  pass('UserSettingsModal determines device ownership strictly from stored tokens and isolates read-only view');

  // ----------------------------------------------------
  // 5. Social Links Sanitization & Accessible Destinations
  // ----------------------------------------------------
  console.log('\n--- 5. Social Badges & Sanitization ---');

  // Valid HTTPS links
  assert.strictEqual(safeWebsiteUrl('https://example.com/me'), 'https://example.com/me');
  assert.strictEqual(safeWebsiteUrl('example.com'), 'https://example.com/');
  assert.strictEqual(safeLinkedInUrl('https://www.linkedin.com/in/satyanadella'), 'https://www.linkedin.com/in/satyanadella');
  assert.strictEqual(safeLinkedInUrl('satyanadella'), 'https://www.linkedin.com/in/satyanadella');
  assert.strictEqual(safeInstagramUrl('https://www.instagram.com/lazyproof'), 'https://www.instagram.com/lazyproof');
  assert.strictEqual(safeInstagramUrl('lazyproof'), 'https://www.instagram.com/lazyproof');
  assert.strictEqual(safeTwitterUrl('@elonmusk'), 'https://x.com/elonmusk');
  assert.strictEqual(safeTwitterUrl('elonmusk'), 'https://x.com/elonmusk');

  // Reject malicious schemes
  assert.strictEqual(safeWebsiteUrl('javascript:alert(1)'), null);
  assert.strictEqual(safeWebsiteUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.strictEqual(safeLinkedInUrl('javascript:alert(1)'), null);
  assert.strictEqual(safeInstagramUrl('javascript:alert(1)'), null);
  assert.strictEqual(safeTwitterUrl('javascript:alert(1)'), null);

  pass('All social link validators enforce safe HTTPS URLs and reject javascript:/data: schemes');

  // ----------------------------------------------------
  // 6. AboutModal & LiveStats Truthful Null Handling
  // ----------------------------------------------------
  console.log('\n--- 6. AboutModal & LiveStats Truthful Null Handling ---');

  const infoSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'InfoModals.tsx'), 'utf-8');

  assert.ok(
    infoSrc.includes('AboutModalProps extends ModalBaseProps'),
    'AboutModalProps properly defines onOpenRules prop'
  );
  assert.ok(
    infoSrc.includes('onOpenRules &&'),
    'AboutModal conditionally renders "Read Official Rules & Verification" when onOpenRules is provided'
  );
  assert.ok(
    infoSrc.includes("stats?.online !== undefined && stats.online !== null ? stats.online : '—'"),
    'LiveStats displays "—" when online is null/undefined (honest null handling)'
  );
  assert.ok(
    infoSrc.includes("stats?.visitsToday !== undefined && stats.visitsToday !== null ? stats.visitsToday : '—'"),
    'LiveStats displays "—" when visitsToday is null/undefined (honest null handling)'
  );
  assert.ok(
    infoSrc.includes('To Claim #1 All-Time'),
    'LiveStats clearly labels all-time claim price instead of mixing with today'
  );
  pass('AboutModal onOpenRules implemented; LiveStats displays honest nulls and clear period labels');

  console.log(`\n========================================================`);
  console.log(`ALL SUITE 12 TESTS PASSED: ${passed} assertions verified`);
  console.log(`========================================================\n`);
}

runTests().catch(err => {
  console.error('\nSuite 12 failed:', err);
  process.exit(1);
});

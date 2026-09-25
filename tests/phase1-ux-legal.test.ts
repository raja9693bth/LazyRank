import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { LEGAL_CONFIG } from '../src/config/legal.ts';
import { SERVER_LEGAL_CONFIG } from '../server/config/legal.ts';
import { prerenderRoute } from '../server/prerender.tsx';

export async function runPhase1Tests() {
  console.log('\n========================================================');
  console.log('RUNNING PHASE 1: LEGAL IDENTITY, UX TRUTH, & CRAWLER ACCESSIBILITY');
  console.log('========================================================\n');

  let passed = 0;
  function pass(msg: string) {
    passed++;
    console.log(`  ✓ PASS: ${msg}`);
  }

  // 1. Legal Identity Canonical Configuration
  console.log('--- 1. Canonical Legal Identity Invariants ---');
  assert.strictEqual(LEGAL_CONFIG.LEGAL_BUSINESS_NAME, 'ADABHRA GROUP');
  assert.strictEqual(SERVER_LEGAL_CONFIG.LEGAL_BUSINESS_NAME, 'ADABHRA GROUP');
  assert.strictEqual(LEGAL_CONFIG.ENTITY_TYPE, 'Sole Proprietorship');
  assert.strictEqual(LEGAL_CONFIG.PROPRIETOR_NAME, 'Raja Babu');
  assert.strictEqual(
    LEGAL_CONFIG.PUBLIC_BUSINESS_ADDRESS,
    'Ward No. 13, Mahodipur, Majhaulia, West Champaran, Bihar - 845454, India'
  );
  assert.strictEqual(LEGAL_CONFIG.SUPPORT_EMAIL, 'support@lazyproof.online');
  assert.strictEqual(LEGAL_CONFIG.SUPPORT_PHONE, '+91 95211 90205');
  assert.strictEqual(LEGAL_CONFIG.SUPPORT_PHONE_HREF, 'tel:+919521190205');
  pass('Canonical legal configuration has exact identity, proprietor, and phone href');

  // 2. Simulated Activity & Heatmap Truthfulness
  console.log('\n--- 2. Global Activity Heatmap Truthfulness ---');
  const heatmapSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/GlobalActivityHeatmap.tsx'), 'utf-8');
  assert(heatmapSrc.includes('const claimsToday: number = data?.claimsToday ?? 0;'), 'claimsToday defaults strictly to 0');
  assert(heatmapSrc.includes('const totalAmountToday: number = data?.totalAmountToday ?? 0;'), 'totalAmountToday defaults strictly to 0');
  assert(heatmapSrc.includes('const latestMinutesAgo: number | null = data?.latestClaimMinutesAgo ?? null;'), 'latestMinutesAgo defaults strictly to null');
  assert(heatmapSrc.includes("'No claims yet'"), 'Displays "No claims yet" when latestMinutesAgo is null');
  assert(!heatmapSrc.includes('claimsCount: i >= 10 && i <= 18 ? 2 : 0'), 'No synthetic claims count injection');
  assert(!heatmapSrc.includes('amount: i >= 10 && i <= 18 ? 1200 : 0'), 'No synthetic amount injection');
  pass('Heatmap defaults strictly to 0 / ₹0 / "No claims yet" without fake history');

  // 3. Price Defaults & Amount Protection
  console.log('\n--- 3. Price Defaults & User Input Protection ---');
  const appSrc = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');
  assert(appSrc.includes('const [topAmount, setTopAmount] = useState<number>(0);'), 'topAmount default is 0');
  assert(appSrc.includes('const [minAmountToBeatTop, setMinAmountToBeatTop] = useState<number>(1);'), 'minAmountToBeatTop default is 1');
  pass('App defaults topAmount to 0 and minAmountToBeatTop to 1');

  const actionPanelSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/ActionPanel.tsx'), 'utf-8');
  assert(actionPanelSrc.includes('const [amountTouched, setAmountTouched] = useState<boolean>(false);'), 'Tracks amountTouched state');
  assert(actionPanelSrc.includes('if (!amountTouched)'), 'Does not overwrite user-touched amount on leaderboard refresh');
  assert(actionPanelSrc.includes('setAmountTouched(true);'), 'Sets amountTouched when user types or clicks chips');
  assert(actionPanelSrc.includes('const [termsAccepted, setTermsAccepted] = useState(false);'), 'Consent checkbox strictly defaults to false');
  pass('ActionPanel preserves user-typed amount and keeps consent initially unchecked');

  // 4. Crawlable Footer Anchors & Phone Href
  console.log('\n--- 4. Crawlable Footer Anchors ---');
  const footerSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/Footer.tsx'), 'utf-8');
  const requiredRoutes = [
    '/about',
    '/rules',
    '/terms',
    '/privacy',
    '/refund-cancellation',
    '/delivery',
    '/contact'
  ];
  for (const route of requiredRoutes) {
    assert(footerSrc.includes(`href="${route}"`), `Footer contains crawlable anchor for ${route}`);
  }
  assert(footerSrc.includes('href={LEGAL_CONFIG.SUPPORT_PHONE_HREF}'), 'Footer phone uses tel: href anchor');
  assert(footerSrc.includes('Proprietor: {LEGAL_CONFIG.PROPRIETOR_NAME}'), 'Footer declares proprietor name');
  assert(footerSrc.includes('{LEGAL_CONFIG.PUBLIC_BUSINESS_ADDRESS}'), 'Footer includes public business address');
  pass('Footer has crawlable <a> anchors for all legal routes, telephone link, and proprietor');

  // 5. SSR Prerendered HTML Substantive Content
  console.log('\n--- 5. SSR Prerendered Legal Pages Body ---');
  for (const route of requiredRoutes) {
    const html = prerenderRoute(route);
    assert(html !== null && html.length > 200, `prerenderRoute("${route}") generates substantive HTML`);
    assert(html.includes('ADABHRA GROUP'), `${route} prerender contains legal entity ADABHRA GROUP`);
  }

  const termsHtml = prerenderRoute('/terms')!;
  assert(termsHtml.includes('Raja Babu'), 'Terms page prerender includes proprietor Raja Babu');
  assert(termsHtml.includes('Ward No. 13, Mahodipur, Majhaulia'), 'Terms page prerender includes full address');

  const refundHtml = prerenderRoute('/refund-cancellation')!;
  assert(refundHtml.includes('7-Calendar-Day Claim Window'), 'Refund page prerender states 7-calendar-day claim window');

  const deliveryHtml = prerenderRoute('/delivery')!;
  assert(deliveryHtml.includes('Deliverables &amp; Ranking Dynamic') || deliveryHtml.includes('Deliverables & Ranking Dynamic'), 'Delivery page specifies deliverable dynamic ranking');
  pass('Prerendered legal routes contain full business address, proprietor, and specific policies');

  // 6. Unknown Routes 404 & Routing Contract
  console.log('\n--- 6. Routing Contract & 404 Handling ---');
  const serverSrc = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
  assert(serverSrc.includes('isKnownSpaPath'), 'Server implements isKnownSpaPath filter');
  assert(serverSrc.includes("res.status(404).type('text/plain').send('Not found')"), 'Unknown routes return 404 text');
  assert(serverSrc.includes("app.all('/api/*', (_req: Request, res: Response) => {"), 'Unknown API routes return 404 JSON');
  assert(serverSrc.includes('prerenderRoute(cleanPath)'), 'Server injects prerendered HTML into #root');
  pass('Server returns 404 for unknown paths and injects prerendered HTML on known paths');

  // 7. PWA Manifest & OG Dimensions
  console.log('\n--- 7. Manifest & OG Metadata ---');
  const manifestPath = path.join(process.cwd(), 'public/manifest.webmanifest');
  assert(fs.existsSync(manifestPath), 'public/manifest.webmanifest exists');
  const manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  assert.strictEqual(manifestJson.name, 'LazyProof');
  assert.strictEqual(manifestJson.start_url, '/');

  const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
  assert(indexHtml.includes('rel="manifest" href="/manifest.webmanifest"'), 'index.html links to manifest.webmanifest');
  assert(indexHtml.includes('property="og:image:width" content="512"'), 'OG image width matches 512');
  assert(indexHtml.includes('property="og:image:height" content="512"'), 'OG image height matches 512');
  assert(indexHtml.includes('"name": "ADABHRA GROUP"'), 'index.html JSON-LD publisher is ADABHRA GROUP');
  assert(fs.existsSync(path.join(process.cwd(), 'public/apple-touch-icon.png')), 'apple-touch-icon.png exists in public');
  pass('Manifest and OG metadata are verified');

  // 8. Roast copy update
  console.log('\n--- 8. Roast Copy Verification ---');
  const roastSrc = fs.readFileSync(path.join(process.cwd(), 'server/roast.ts'), 'utf-8');
  assert(roastSrc.includes('spent ${formattedAmount} on sponsored placement for Rank #${rank}'), 'Roast copy uses spent on sponsored placement');
  assert(!roastSrc.includes('invested ${formattedAmount} into Rank #${rank}'), 'Roast copy no longer uses invested');
  pass('Roast copy verified without investment wording');

  console.log(`\nPHASE 1 COMPLETE: All ${passed} tests passed successfully.\n`);
  return passed;
}

// Allow standalone execution
if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') || '')) {
  runPhase1Tests().catch((err) => {
    console.error('Phase 1 test failure:', err);
    process.exit(1);
  });
}

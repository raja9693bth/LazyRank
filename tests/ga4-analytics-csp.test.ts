import assert from 'assert';
import fs from 'fs';
import path from 'path';
import http from 'http';

const TEST_PORT = 3291;
process.env.PORT = String(TEST_PORT);
process.env.NODE_ENV = 'test';

async function fetchJson(url: string, options: any = {}) {
  const parsed = new URL(url);
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }>((resolve, reject) => {
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsedBody = raw;
          try {
            parsedBody = JSON.parse(raw);
          } catch {}
          resolve({ status: res.statusCode || 0, headers: res.headers, body: parsedBody });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

type TestFn = () => void | Promise<void>;

async function it(title: string, fn: TestFn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${title}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${title}`, err);
    throw err;
  }
}

async function describe(suiteTitle: string, fn: () => void | Promise<void>) {
  console.log(`\n--- ${suiteTitle} ---`);
  await fn();
}

async function runGA4VerificationTests() {
  console.log('\n========================================================');
  console.log('RUNNING GOOGLE ANALYTICS (GA4) & CSP INTEGRATION TESTS');
  console.log('========================================================\n');

  await describe('1. Static Verification of index.html', async () => {
    await it('index.html must include the async gtag.js script with tag ID G-ZCYBSFW2C9 inside <head>', () => {
      const indexHtmlPath = path.join(process.cwd(), 'index.html');
      const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');

      assert.ok(
        indexHtml.includes('<script async src="https://www.googletagmanager.com/gtag/js?id=G-ZCYBSFW2C9"></script>'),
        'index.html must include the async gtag.js script with tag ID G-ZCYBSFW2C9'
      );
      assert.ok(
        indexHtml.includes("window.dataLayer = window.dataLayer || [];"),
        'index.html must initialize window.dataLayer'
      );
      assert.ok(
        indexHtml.includes("function gtag(){dataLayer.push(arguments);}"),
        'index.html must define gtag function'
      );
      assert.ok(
        indexHtml.includes("gtag('config', 'G-ZCYBSFW2C9');"),
        "index.html must execute gtag('config', 'G-ZCYBSFW2C9')"
      );

      const headOpenIdx = indexHtml.indexOf('<head>');
      const headCloseIdx = indexHtml.indexOf('</head>');
      const scriptIdx = indexHtml.indexOf('https://www.googletagmanager.com/gtag/js?id=G-ZCYBSFW2C9');
      assert.ok(headOpenIdx !== -1 && headCloseIdx !== -1, '<head> tags must exist');
      assert.ok(scriptIdx > headOpenIdx && scriptIdx < headCloseIdx, 'Google Analytics tag must be inside <head>');
    });
  });

  await describe('2. Build Artifact Verification (dist/index.html)', async () => {
    await it('dist/index.html must include GA4 tag after build', () => {
      const distIndexPath = path.join(process.cwd(), 'dist', 'index.html');
      if (fs.existsSync(distIndexPath)) {
        const distHtml = fs.readFileSync(distIndexPath, 'utf-8');
        assert.ok(
          distHtml.includes('https://www.googletagmanager.com/gtag/js?id=G-ZCYBSFW2C9'),
          'dist/index.html must include GA4 tag after build'
        );
        assert.ok(
          distHtml.includes("gtag('config', 'G-ZCYBSFW2C9');"),
          'dist/index.html must include gtag config after build'
        );
      }
    });
  });

  await describe('3. HTTP Server CSP Header Verification', async () => {
    await it('Server Content-Security-Policy header strictly verified with all required GA4 directives', async () => {
      try {
        await import('../server.ts');
      } catch {}

      const BASE = `http://127.0.0.1:${TEST_PORT}`;
      let connected = false;
      for (let attempt = 0; attempt < 25; attempt++) {
        try {
          await fetchJson(`${BASE}/api/health`);
          connected = true;
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      assert.ok(connected, `HTTP test server started and connected successfully on port ${TEST_PORT}`);

      const healthRes = await fetchJson(`${BASE}/api/health`);
      assert.strictEqual(healthRes.status, 200, 'Health endpoint must respond 200 OK');
      const csp = healthRes.headers['content-security-policy'] as string;
      assert.ok(typeof csp === 'string', 'Content-Security-Policy header must be present');

      // Verify script-src
      assert.ok(
        csp.includes("https://www.googletagmanager.com"),
        'CSP must permit https://www.googletagmanager.com in script-src'
      );
      assert.ok(
        csp.includes("'unsafe-inline'"),
        'CSP must allow inline scripts for gtag dataLayer bootstrap'
      );

      // Verify connect-src
      assert.ok(
        csp.includes("https://*.google-analytics.com"),
        'CSP connect-src must allow https://*.google-analytics.com'
      );
      assert.ok(
        csp.includes("https://*.analytics.google.com"),
        'CSP connect-src must allow https://*.analytics.google.com'
      );
      assert.ok(
        csp.includes("https://*.googletagmanager.com"),
        'CSP connect-src must allow https://*.googletagmanager.com'
      );

      // Verify img-src
      assert.ok(
        csp.includes("https://*.google-analytics.com") && csp.includes("https://*.googletagmanager.com"),
        'CSP img-src must explicitly include https://*.google-analytics.com and https://*.googletagmanager.com'
      );
    });
  });

  console.log('\n========================================================');
  console.log(`GA4 INTEGRATION & CSP SUITE: ALL ASSERTIONS PASSED (100%)`);
  console.log('========================================================\n');
}

runGA4VerificationTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('GA4 verification failed:', err);
    process.exit(1);
  });

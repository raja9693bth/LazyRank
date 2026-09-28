# LazyProof — Search Discovery & External Presence Action Guide
**Authoritative Operational Document for Founder Action**  
**Operating Entity:** ADABHRA GROUP (Proprietor: Raja Babu)  
**Brand / Website:** LazyProof (`https://lazyproof.online`)  
**Document Version:** 1.0 (September 2026)

---

## Executive Summary: Code Complete vs. External Actions

Search readiness and organic discovery require two distinct phases:

1. **TECHNICAL & REPOSITORY LAYER (CODE COMPLETE):**  
   - Semantic HTML, unique route metadata (`title`, `description`, `canonical`).
   - Server-side prerendering and metadata injection for crawlers.
   - Clean, stable Schema.org structured data (`WebSite`, `Organization`, `WebApplication`, `ProfilePage`, `BreadcrumbList`).
   - Crawlable public profile links (`<a href="/profile/:id">`).
   - Static XML sitemap (`/sitemap.xml`) for stable platform routes.
   - Dynamic authoritative PostgreSQL XML sitemap (`/sitemap-profiles.xml`) for active, positive-net verified public profiles.
   - Strict `robots.txt` referencing both sitemaps and disallowing internal admin endpoints.
   - HSTS and strict Content Security Policy (CSP).

2. **FOUNDER & SEARCH ENGINE EXTERNAL ACTIONS (EXTERNAL ACTIONS REQUIRED):**  
   - DNS verification in Google Search Console (GSC).
   - Sitemap submission in GSC.
   - Live URL Inspection and manual indexing requests.
   - Setting up authentic, verified company profiles on LinkedIn, X, and other business directories.
   - Monitoring Search Console performance and indexing coverage over time.

---

## Part 1: Google Search Console (GSC) Step-by-Step SOP

### Step 1: Create a Domain Property in Search Console
1. Navigate to [Google Search Console](https://search.google.com/search-console).
2. Click **Add Property** in the property selector dropdown.
3. Select the **Domain** property type (left option) and enter:
   ```text
   lazyproof.online
   ```
   *(Using a Domain property covers all subdomains, both `https://` and `http://`, and both `www` and root).*

### Step 2: Complete DNS TXT Verification
1. Google will provide a unique TXT record token (e.g. `google-site-verification=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`).
2. Log into your domain registrar/DNS provider (e.g. Hostinger, Cloudflare, Namecheap).
3. Add a **TXT** record at the root (`@`):
   - **Type:** `TXT`
   - **Name / Host:** `@` (or leave blank depending on registrar)
   - **Value:** Paste the exact token supplied by Google.
   - **TTL:** 300 seconds (or Default/Auto).
4. Return to Search Console and click **Verify**.
5. **CRITICAL REPOSITORY RULE:** Never paste temporary or placeholder verification tokens into repository code (`index.html`, `server.ts`, etc.). DNS verification is cleaner, more secure, and does not pollute frontend source code.

### Step 3: Submit Authority Sitemaps
Once ownership is verified, open **Sitemaps** from the left navigation menu. Enter and submit:
1. `sitemap.xml`  
   *(Full URL: `https://lazyproof.online/sitemap.xml`)*  
   Covers static compliance and platform pages (`/`, `/about`, `/rules`, `/pricing`, `/terms`, `/privacy`, `/refund-cancellation`, `/delivery`, `/contact`).
2. `sitemap-profiles.xml`  
   *(Full URL: `https://lazyproof.online/sitemap-profiles.xml`)*  
   Dynamically generated from authoritative PostgreSQL. Contains only active, non-moderated, verified public profiles with net sponsorship > ₹0.

Verify that both sitemaps show **Status: Success** after submission.

### Step 4: URL Inspection & Indexing Queue
1. Use the search bar at the top of Google Search Console (*"Inspect any URL in 'lazyproof.online'"*).
2. Inspect the core platform URLs in sequence:
   - `https://lazyproof.online/`
   - `https://lazyproof.online/about`
   - `https://lazyproof.online/rules`
   - `https://lazyproof.online/pricing`
   - `https://lazyproof.online/terms`
   - `https://lazyproof.online/privacy`
   - `https://lazyproof.online/refund-cancellation`
   - `https://lazyproof.online/delivery`
   - `https://lazyproof.online/contact`
3. For each URL:
   - Click **Test Live URL**.
   - Confirm that the response is HTTP 200, the page can be fetched, and structured data is detected without syntax errors.
   - Click **Request Indexing**.
4. Repeat this for active public profile URLs (`https://lazyproof.online/profile/:id`) once real public placements are created.

### Step 5: Ongoing Search Console Health Monitoring
Check Google Search Console periodically for:
- **Pages (Indexing Coverage):** Ensure pages move from "Discovered - currently not indexed" or "Crawled - currently not indexed" to "Indexed".
- **Performance:** Track total impressions, clicks, average CTR, and ranking queries.
- **Enhancements / Structured Data:** Verify that WebSite, Organization, Breadcrumbs, and ProfilePage report valid items with 0 critical errors.
- **Security & Manual Actions:** Confirm "No issues detected" under Security & Manual Actions.

---

## Part 2: Truthful Indexing, Crawling & Search Realities

**Read and absorb the following fundamental search truths:**

1. **Google Controls Crawling & Indexing:**  
   Submitting sitemaps and requesting indexing informs Google that pages exist, but does **NOT** guarantee that Google will index them immediately or keep them in the index permanently. Google evaluates site quality, uniqueness, user value, and server reliability.
2. **Structured Data Is Not a Rich Snippet Guarantee:**  
   Valid Schema.org markup tells search engines what your entities represent, but search engines algorithmically decide when, where, and if to render rich results, sitelinks, or knowledge panels.
3. **Branded vs. Generic Query Visibility:**  
   - Direct branded queries (*"LazyProof"*, *"lazyproof.online"*) typically rank well once the site is indexed and search engines associate the domain with the brand.
   - Highly generic or broad queries (*"entertainment website"*, *"social proof platform"*) face competition against established domains with millions of backlinks. Ranking for broad terms requires consistent organic authority, high-quality editorial mentions, authentic user demand, and time.
4. **Prohibited Black-Hat SEO Practices (Strictly Forbidden):**  
   - **Never add meta keywords:** Google ignored `<meta name="keywords">` over 15 years ago; adding spam keywords triggers algorithmic quality penalties.
   - **Never keyword stuff:** Adding repetitive keywords in hidden divs, micro-fonts, or unnatural footer text triggers SpamBrain penalties.
   - **Never purchase spam backlinks or use automated link networks:** Google algorithms aggressively neutralize unnatural links and can issue manual penalties.
   - **Never create doorway pages or duplicate thin pages.**
   - **Never invent fake reviews, fake ratings, or fake testimonials:** Under consumer protection regulations and Google search quality guidelines, fake reviews constitute deceptive commercial practices.

---

## Part 3: LinkedIn & Social Discovery Action Guide

### The Reality of Social Search
LinkedIn, X (formerly Twitter), Facebook, and Instagram **do not** index or discover companies via HTML meta tags or robots.txt. Their internal search bars query their own internal user and organization database.

### Founder Action Checklist for External Social Presence:

1. **Create an Official LinkedIn Company Page:**  
   - Go to [LinkedIn Company Creation](https://www.linkedin.com/company/setup/new/).
   - **Company Name:** `LazyProof` (or `ADABHRA GROUP`).
   - **LinkedIn Public URL:** `linkedin.com/company/lazyproof` (or similar available handle).
   - **Website:** `https://lazyproof.online`
   - **Industry:** Digital Media, Entertainment Providers, or Technology.
   - **Organization Size:** Sole Proprietorship / 1-10 employees.
   - **Logo:** Upload official square brand avatar (`lazy-avatar-light.png`).
   - **Tagline:** *"Digital sponsored profile showcase & live public leaderboard."*
   - **Description:** Accurate, factual summary aligned with the public About and Rules pages.

2. **Establish Official X (Twitter) & Instagram Accounts:**  
   - Register handles representing LazyProof or Adabhra Group.
   - Link `https://lazyproof.online` in the bio.
   - Upload official brand avatars.
   - Publish genuine updates, feature announcements, and humorous leaderboard recaps.

3. **Wiring Social Links into Structured Data (`sameAs`):**  
   - Once authentic social profile URLs are live and verified, add those specific URLs to the `sameAs` array in `src/utils/seo.ts` and `index.html`.
   - **Never fabricate placeholder or dead social URLs** in repository code before those profiles are officially created.

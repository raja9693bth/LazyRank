import { UserProfile } from '../src/types.ts';
import { SERVER_LEGAL_CONFIG } from './config/legal.ts';

const DEFAULT_APP_URL = process.env.NODE_ENV === 'production' ? 'https://lazyproof.online' : 'http://localhost:3000';
export const BASE_URL = (process.env.APP_URL || DEFAULT_APP_URL).replace(/\/+$/, '');

/**
 * Safely serializes JSON-LD structured data for injection into <script type="application/ld+json">
 * Escapes <, >, and & characters to prevent script-breakout XSS attacks (e.g. </script><script>alert(1)</script>)
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateProfileJsonLd(profile: UserProfile, baseUrl: string = BASE_URL): object {
  const formattedAmount = `₹${profile.amount.toLocaleString('en-IN')}`;
  const profileUrl = `${baseUrl}/?rank=${encodeURIComponent(profile.id)}`;
  const description = profile.roast
    ? `“${profile.roast}” — Verified Rank #${profile.rank} with a paid claim of ${formattedAmount} on LAZY.`
    : profile.reason
    ? `“${profile.reason}” — Verified Rank #${profile.rank} with a paid claim of ${formattedAmount} on LAZY.`
    : `Verified Rank #${profile.rank} with an authentic paid claim of ${formattedAmount} on LAZY.`;

  const sameAs: string[] = [];
  if (profile.twitter) {
    const cleanTwitter = profile.twitter.replace(/^@/, '').replace(/^(https?:\/\/)?(www\.)?(twitter|x)\.com\//, '').trim();
    if (/^[a-zA-Z0-9_]{1,15}$/.test(cleanTwitter)) {
      sameAs.push(`https://x.com/${cleanTwitter}`);
    }
  }
  if (profile.instagram) {
    const cleanIg = profile.instagram.replace(/^@/, '').replace(/^(https?:\/\/)?(www\.)?instagram\.com\//, '').trim();
    if (/^[a-zA-Z0-9._]{1,30}$/.test(cleanIg)) {
      sameAs.push(`https://instagram.com/${cleanIg}`);
    }
  }
  if (profile.linkedin) {
    const trimmed = profile.linkedin.trim();
    if (/^(https?:\/\/)?([a-z]{2,3}\.)?linkedin\.com\/.*$/i.test(trimmed)) {
      sameAs.push(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    }
  }
  if (profile.website) {
    const trimmed = profile.website.trim();
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      if (['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.')) {
        sameAs.push(url.href);
      }
    } catch {}
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage',
        '@id': `${profileUrl}#webpage`,
        url: profileUrl,
        name: `${profile.name} — Rank #${profile.rank} (${formattedAmount}) on LAZY`,
        description,
        dateCreated: profile.createdAt,
        dateModified: profile.updatedAt || profile.createdAt,
        inLanguage: 'en-IN',
        isPartOf: {
          '@type': 'WebSite',
          '@id': `${baseUrl}/#website`,
          name: 'LAZY',
          url: `${baseUrl}/`
        },
        mainEntity: {
          '@type': 'Person',
          '@id': `${profileUrl}#person`,
          name: profile.name,
          identifier: profile.id,
          description,
          image: `${baseUrl}/api/og/card/${encodeURIComponent(profile.id)}.png`,
          award: `Rank #${profile.rank} on LAZY Public Legitimacy Leaderboard`,
          ...(sameAs.length > 0 ? { sameAs } : {}),
          interactionStatistic: {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/LikeAction',
            userInteractionCount: profile.votesCount || 0
          }
        }
      },
      {
        '@type': 'WebSite',
        '@id': `${baseUrl}/#website`,
        name: 'LAZY',
        url: `${baseUrl}/`,
        description: 'Public legitimacy leaderboard where higher verified payment equals higher rank.',
        inLanguage: 'en-IN',
        publisher: {
          '@type': 'Organization',
          name: SERVER_LEGAL_CONFIG.LEGAL_BUSINESS_NAME || 'ADABHRA GROUP',
          url: baseUrl
        }
      }
    ]
  };
}

export function generateProfileOgSvg(profile: UserProfile): string {
  const formattedAmount = `₹${profile.amount.toLocaleString('en-IN')}`;
  const safeName = escapeXml(profile.name.slice(0, 32));
  const rawQuote = profile.roast || profile.reason || 'Paid to prove laziness. No excuses.';
  const safeQuote = escapeXml(rawQuote.slice(0, 110) + (rawQuote.length > 110 ? '...' : ''));
  const isApex = profile.rank === 1;
  const isPodium = profile.rank <= 3;
  const badgeColor = isApex ? '#9c3a16' : isPodium ? '#c2410c' : '#57534e';
  const badgeText = isApex ? '#1 TOP SPONSOR' : isPodium ? `PODIUM RANK #${profile.rank}` : `LEADERBOARD RANK #${profile.rank}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Light Cream Background -->
  <rect width="1200" height="630" fill="#faf8f5"/>
  
  <!-- Subtle warm accent glow -->
  <circle cx="150" cy="120" r="380" fill="#ea580c" fill-opacity="0.08" filter="blur(90px)"/>
  <circle cx="1050" cy="510" r="320" fill="#c2410c" fill-opacity="0.06" filter="blur(90px)"/>

  <!-- Border Card Frame -->
  <rect x="36" y="36" width="1128" height="558" rx="28" stroke="#f2ded0" stroke-width="2"/>
  <rect x="38" y="38" width="1124" height="554" rx="26" fill="#ffffff" fill-opacity="0.95"/>

  <!-- Header Brand Bar -->
  <g transform="translate(80, 80)">
    <!-- Brand Pill -->
    <rect width="130" height="42" rx="10" fill="#faeee5"/>
    <text x="22" y="28" fill="#9c3a16" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="900" letter-spacing="3">LAZY</text>
    <text x="145" y="28" fill="#78716c" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="600">lazyproof.online</text>
  </g>

  <!-- Rank Badge (Top Right) -->
  <g transform="translate(820, 76)">
    <rect width="300" height="48" rx="24" fill="${badgeColor}" fill-opacity="0.10" stroke="${badgeColor}" stroke-opacity="0.3" stroke-width="1.5"/>
    <text x="150" y="30" text-anchor="middle" fill="${badgeColor}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" letter-spacing="1">${badgeText}</text>
  </g>

  <!-- Participant Identity Block -->
  <g transform="translate(80, 190)">
    <text x="0" y="20" fill="#78716c" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="700" letter-spacing="2">VERIFIED PARTICIPANT</text>
    <text x="0" y="80" fill="#1c1917" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="56" font-weight="900" letter-spacing="-1">${safeName}</text>
  </g>

  <!-- Amount Card Highlight -->
  <g transform="translate(80, 310)">
    <rect width="420" height="84" rx="18" fill="#faf8f5" fill-opacity="0.9" stroke="#f2ded0" stroke-width="1.5"/>
    <text x="28" y="32" fill="#78716c" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" letter-spacing="1">VERIFIED MONETARY CLAIM</text>
    <text x="28" y="68" fill="#059669" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="36" font-weight="900" letter-spacing="-0.5">${formattedAmount}</text>
    <text x="400" y="52" text-anchor="end" fill="#059669" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800">✓ PROVEN</text>
  </g>

  <!-- Quote / Statement Card -->
  <g transform="translate(80, 425)">
    <rect width="1040" height="96" rx="16" fill="#fdfbf7" fill-opacity="0.9" stroke="#f2ded0" stroke-width="1"/>
    <text x="28" y="54" fill="#292524" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="600" font-style="italic">“${safeQuote}”</text>
  </g>

  <!-- Bottom CTA Footer -->
  <g transform="translate(80, 548)">
    <text x="0" y="16" fill="#78716c" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600">Can you beat this rank? Claim your rank on lazyproof.online</text>
    <text x="1040" y="16" text-anchor="end" fill="#9c3a16" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="800">SPONSORED SHOWCASE →</text>
  </g>
</svg>`;
}

export function injectProfileMetadata(
  htmlTemplate: string,
  profile: UserProfile,
  baseUrl: string = BASE_URL
): string {
  const formattedAmount = `₹${profile.amount.toLocaleString('en-IN')}`;
  const rawQuote = profile.roast || profile.reason || 'Paid to prove laziness. No excuses.';
  const pageTitle = `${profile.name} — Rank #${profile.rank} (${formattedAmount}) on LAZY`;
  const metaDescription = `“${rawQuote.slice(0, 120)}” — ${profile.name} claimed Rank #${profile.rank} with a verified ${formattedAmount} payment on LAZY. Can you beat it?`;
  const canonicalUrl = `${baseUrl}/?rank=${encodeURIComponent(profile.id)}`;
  const ogImageUrl = `${baseUrl}/api/og/card/${encodeURIComponent(profile.id)}.png`;
  const imageAlt = `${profile.name} — Rank #${profile.rank} (${formattedAmount}) Verified Proof Card on LAZY`;
  const jsonLdData = generateProfileJsonLd(profile, baseUrl);
  const jsonLdString = serializeJsonLd(jsonLdData);

  let output = htmlTemplate;

  // Helper to replace regex safely without $-replacement artifacts
  const safeReplace = (regex: RegExp, replacement: string) => {
    output = output.replace(regex, () => replacement);
  };

  // Replace <title>
  safeReplace(/<title>.*?<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`);

  // Replace <meta name="description">
  safeReplace(
    /<meta\s+name=["']description["']\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${escapeHtml(metaDescription)}" />`
  );

  // Replace <link rel="canonical">
  safeReplace(
    /<link\s+rel=["']canonical["']\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`
  );

  // Replace Open Graph tags
  safeReplace(
    /<meta\s+property=["']og:title["']\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${escapeHtml(pageTitle)}" />`
  );
  safeReplace(
    /<meta\s+property=["']og:description["']\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${escapeHtml(metaDescription)}" />`
  );
  safeReplace(
    /<meta\s+property=["']og:url["']\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`
  );
  safeReplace(
    /<meta\s+property=["']og:image["']\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:image" content="${escapeHtml(ogImageUrl)}" />`
  );
  safeReplace(
    /<meta\s+property=["']og:image:secure_url["']\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:image:secure_url" content="${escapeHtml(ogImageUrl)}" />`
  );
  safeReplace(
    /<meta\s+property=["']og:image:alt["']\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`
  );
  safeReplace(
    /<meta\s+property=["']og:type["']\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:type" content="profile" />`
  );

  // Replace Twitter Card tags
  safeReplace(
    /<meta\s+name=["']twitter:title["']\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:title" content="${escapeHtml(pageTitle)}" />`
  );
  safeReplace(
    /<meta\s+name=["']twitter:description["']\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:description" content="${escapeHtml(metaDescription)}" />`
  );
  safeReplace(
    /<meta\s+name=["']twitter:image["']\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />`
  );
  safeReplace(
    /<meta\s+name=["']twitter:image:alt["']\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}" />`
  );

  // Replace or inject <script type="application/ld+json">...</script>
  const jsonLdTag = `<script id="schema-structured-data" type="application/ld+json">\n${jsonLdString}\n    </script>`;
  const jsonLdRegex = /<script\s+(?:id=["']schema-structured-data["']\s+)?type=["']application\/ld\+json["']>[\s\S]*?<\/script>/i;
  if (jsonLdRegex.test(output)) {
    safeReplace(jsonLdRegex, jsonLdTag);
  } else if (/<\/head>/i.test(output)) {
    output = output.replace(/<\/head>/i, `  ${jsonLdTag}\n</head>`);
  } else {
    output += `\n${jsonLdTag}`;
  }

  return output;
}

export interface RouteSeoMeta {
  title: string;
  description: string;
  canonicalPath: string;
  ogType?: string;
  breadcrumbName?: string;
}

export const ROUTE_SEO: Record<string, RouteSeoMeta> = {
  '/': {
    title: "LazyProof — Digital Sponsored Profile Showcase | Live Leaderboard",
    description: "LazyProof is a public digital sponsored showcase where verified cumulative sponsorship determines leaderboard position. Transparent, competitive, and humorous.",
    canonicalPath: '/',
    ogType: 'website',
    breadcrumbName: 'Home'
  },
  '/about': {
    title: "About LazyProof — Digital Sponsored Profile Showcase & Social Proof",
    description: "Discover the philosophy behind LazyProof: transforming humorous claims into verified social proof, algorithmic ranking transparency, and shareable 9:16 proof cards.",
    canonicalPath: '/about',
    ogType: 'website',
    breadcrumbName: 'About'
  },
  '/rules': {
    title: "Official Rules & Ranking Mechanics — How LazyProof Works",
    description: "Comprehensive breakdown of LazyProof rules: verified cumulative sponsorship, deterministic tie-breaking by timestamp, and real-time position displacement.",
    canonicalPath: '/rules',
    ogType: 'website',
    breadcrumbName: 'Rules'
  },
  '/pricing': {
    title: "Pricing & Placement Policy — LazyProof Digital Sponsorship",
    description: "Official pricing mechanics for LazyProof: transparent INR sponsorship tiers, dynamic #1 spot calculation, live position displacement, and checkout status.",
    canonicalPath: '/pricing',
    ogType: 'website',
    breadcrumbName: 'Pricing'
  },
  '/terms': {
    title: "Terms & Conditions — LazyProof Digital Showcase Platform",
    description: "Official Terms & Conditions for LazyProof by Adabhra Group: public leaderboard participation, verified payment processing, non-defamation conduct policies, and ranking rules.",
    canonicalPath: '/terms',
    ogType: 'website',
    breadcrumbName: 'Terms & Conditions'
  },
  '/privacy': {
    title: "Privacy Policy — How LAZY Handles Your Data",
    description: "LAZY Privacy Policy: understanding public display of names and handles, user data security, and participant data rights.",
    canonicalPath: '/privacy',
    ogType: 'website',
    breadcrumbName: 'Privacy Policy'
  },
  '/refund-cancellation': {
    title: "Refund & Cancellation Policy — LAZY Payment Guidelines",
    description: "Official Refund and Cancellation Policy for LAZY: transparent guidelines for pre-payment cancellation, duplicate charge resolutions, and dispute support.",
    canonicalPath: '/refund-cancellation',
    ogType: 'website',
    breadcrumbName: 'Refund Policy'
  },
  '/refund': {
    title: "Refund & Cancellation Policy — LAZY Payment Guidelines",
    description: "Official Refund and Cancellation Policy for LAZY: transparent guidelines for pre-payment cancellation, duplicate charge resolutions, and dispute support.",
    canonicalPath: '/refund-cancellation',
    ogType: 'website',
    breadcrumbName: 'Refund Policy'
  },
  '/delivery': {
    title: "Digital Delivery & Fulfillment Policy — LazyProof Digital Services",
    description: "Official Delivery and Fulfillment Policy for LazyProof by Adabhra Group: transparent details on digital delivery timelines and automated server verification.",
    canonicalPath: '/delivery',
    ogType: 'website',
    breadcrumbName: 'Delivery Policy'
  },
  '/contact': {
    title: "Contact Support & Verification Help — LazyProof",
    description: "Need assistance with a verified rank claim, duplicate charge, or dispute? Contact the LazyProof customer support desk at support@lazyproof.online.",
    canonicalPath: '/contact',
    ogType: 'website',
    breadcrumbName: 'Contact Us'
  }
};

export function generateRouteJsonLd(route: string, baseUrl: string = BASE_URL): object {
  const normalized = route.replace(/\/+$/, '') || '/';
  const config = ROUTE_SEO[normalized] || ROUTE_SEO['/'];
  const canonicalUrl = `${baseUrl}${config.canonicalPath}`;

  const websiteNode = {
    '@type': 'WebSite',
    '@id': `${baseUrl}/#website`,
    name: 'LazyProof',
    url: `${baseUrl}/`,
    description: 'Digital Sponsored Profile Showcase & Public Leaderboard.',
    inLanguage: 'en-IN',
    publisher: {
      '@type': 'Organization',
      name: SERVER_LEGAL_CONFIG.LEGAL_BUSINESS_NAME,
      url: baseUrl
    }
  };

  if (normalized === '/') {
    return {
      '@context': 'https://schema.org',
      '@graph': [
        websiteNode,
        {
          '@type': 'WebApplication',
          '@id': `${baseUrl}/#app`,
          name: 'LAZY',
          url: `${baseUrl}/`,
          description: config.description,
          applicationCategory: 'EntertainmentApplication',
          operatingSystem: 'All'
        }
      ]
    };
  }

  const breadcrumbNode = {
    '@type': 'BreadcrumbList',
    '@id': `${canonicalUrl}#breadcrumb`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${baseUrl}/`
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: config.breadcrumbName || 'Page',
        item: canonicalUrl
      }
    ]
  };

  let pageType = 'WebPage';
  let extraProps: Record<string, any> = {};

  if (normalized === '/about') {
    pageType = 'AboutPage';
  } else if (normalized === '/contact') {
    pageType = 'ContactPage';
    extraProps = {
      mainEntity: {
        '@type': 'Organization',
        name: SERVER_LEGAL_CONFIG.LEGAL_BUSINESS_NAME,
        url: baseUrl,
        contactPoint: {
          '@type': 'ContactPoint',
          email: SERVER_LEGAL_CONFIG.SUPPORT_EMAIL,
          contactType: 'customer service',
          availableLanguage: ['English', 'Hindi']
        }
      }
    };
  }

  const pageNode = {
    '@type': pageType,
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: config.title,
    description: config.description,
    inLanguage: 'en-IN',
    isPartOf: {
      '@type': 'WebSite',
      '@id': `${baseUrl}/#website`
    },
    breadcrumb: {
      '@id': `${canonicalUrl}#breadcrumb`
    },
    ...extraProps
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      pageNode,
      breadcrumbNode,
      websiteNode
    ]
  };
}

export function injectRouteMetadata(
  htmlTemplate: string,
  pathname: string,
  baseUrl: string = BASE_URL
): string {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const config = ROUTE_SEO[normalized] || ROUTE_SEO['/'];
  const canonicalUrl = `${baseUrl}${config.canonicalPath}`;
  const jsonLdData = generateRouteJsonLd(normalized, baseUrl);
  const jsonLdString = serializeJsonLd(jsonLdData);

  let output = htmlTemplate;

  const safeReplace = (regex: RegExp, replacement: string) => {
    output = output.replace(regex, () => replacement);
  };

  // Replace <title>
  safeReplace(/<title>.*?<\/title>/i, `<title>${escapeHtml(config.title)}</title>`);

  // Replace <meta name="description">
  safeReplace(
    /<meta\s+name=["']description["']\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${escapeHtml(config.description)}" />`
  );

  // Replace <link rel="canonical">
  safeReplace(
    /<link\s+rel=["']canonical["']\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`
  );

  // Replace Open Graph tags
  safeReplace(
    /<meta\s+property=["']og:title["']\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${escapeHtml(config.title)}" />`
  );
  safeReplace(
    /<meta\s+property=["']og:description["']\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${escapeHtml(config.description)}" />`
  );
  safeReplace(
    /<meta\s+property=["']og:url["']\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`
  );
  safeReplace(
    /<meta\s+property=["']og:type["']\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:type" content="${config.ogType || 'website'}" />`
  );

  // Replace Twitter Card tags
  safeReplace(
    /<meta\s+name=["']twitter:title["']\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:title" content="${escapeHtml(config.title)}" />`
  );
  safeReplace(
    /<meta\s+name=["']twitter:description["']\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:description" content="${escapeHtml(config.description)}" />`
  );

  // Replace or inject <script id="schema-structured-data" type="application/ld+json">...</script>
  const jsonLdTag = `<script id="schema-structured-data" type="application/ld+json">\n${jsonLdString}\n    </script>`;
  const jsonLdRegex = /<script\s+(?:id=["']schema-structured-data["']\s+)?type=["']application\/ld\+json["']>[\s\S]*?<\/script>/i;
  if (jsonLdRegex.test(output)) {
    safeReplace(jsonLdRegex, jsonLdTag);
  } else if (/<\/head>/i.test(output)) {
    output = output.replace(/<\/head>/i, `  ${jsonLdTag}\n</head>`);
  } else {
    output += `\n${jsonLdTag}`;
  }

  return output;
}

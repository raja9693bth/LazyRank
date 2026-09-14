import { UserProfile } from '../src/types.ts';

export const BASE_URL = 'https://lazyproof.online';

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
  if (profile.instagram) {
    const cleanIg = profile.instagram.replace(/^@/, '').trim();
    sameAs.push(`https://instagram.com/${cleanIg}`);
  }
  if (profile.linkedin) {
    sameAs.push(profile.linkedin.startsWith('http') ? profile.linkedin : `https://${profile.linkedin}`);
  }
  if (profile.website) {
    sameAs.push(profile.website.startsWith('http') ? profile.website : `https://${profile.website}`);
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
        },
        hasPart: {
          '@type': 'Offer',
          name: 'Verified Public Rank Proof',
          price: profile.amount,
          priceCurrency: 'INR',
          availability: 'https://schema.org/InStock',
          category: 'EntertainmentRanking',
          validFrom: profile.verifiedAt || profile.createdAt
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
          name: 'XAIVON',
          email: 'raja@xaivon.com'
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
  const badgeColor = isApex ? '#fbbf24' : isPodium ? '#f59e0b' : '#38bdf8';
  const badgeText = isApex ? '👑 CURRENT #1 APEX' : isPodium ? `PODIUM RANK #${profile.rank}` : `LEADERBOARD RANK #${profile.rank}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Gradient Background -->
  <rect width="1200" height="630" fill="#09090b"/>
  
  <!-- Ambient Gold / Dark Glows -->
  <circle cx="150" cy="120" r="380" fill="#f59e0b" fill-opacity="0.12" filter="blur(90px)"/>
  <circle cx="1050" cy="510" r="320" fill="#e86638" fill-opacity="0.10" filter="blur(90px)"/>

  <!-- Border Card Frame -->
  <rect x="36" y="36" width="1128" height="558" rx="28" stroke="#27272a" stroke-width="2"/>
  <rect x="38" y="38" width="1124" height="554" rx="26" fill="#18181b" fill-opacity="0.85"/>

  <!-- Header Brand Bar -->
  <g transform="translate(80, 80)">
    <!-- Brand Pill -->
    <rect width="130" height="42" rx="10" fill="#27272a"/>
    <text x="22" y="28" fill="#fafafa" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="900" letter-spacing="3">LAZY</text>
    <text x="145" y="28" fill="#71717a" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="600">lazyproof.online</text>
  </g>

  <!-- Rank Badge (Top Right) -->
  <g transform="translate(820, 76)">
    <rect width="300" height="48" rx="24" fill="${badgeColor}" fill-opacity="0.15" stroke="${badgeColor}" stroke-opacity="0.5" stroke-width="1.5"/>
    <text x="150" y="30" text-anchor="middle" fill="${badgeColor}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" letter-spacing="1">${badgeText}</text>
  </g>

  <!-- Participant Identity Block -->
  <g transform="translate(80, 190)">
    <text x="0" y="20" fill="#a1a1aa" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="700" letter-spacing="2">VERIFIED PARTICIPANT</text>
    <text x="0" y="80" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="56" font-weight="900" letter-spacing="-1">${safeName}</text>
  </g>

  <!-- Amount Card Highlight -->
  <g transform="translate(80, 310)">
    <rect width="420" height="84" rx="18" fill="#27272a" fill-opacity="0.7" stroke="#3f3f46" stroke-width="1.5"/>
    <text x="28" y="32" fill="#71717a" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" letter-spacing="1">VERIFIED MONETARY CLAIM</text>
    <text x="28" y="68" fill="#10b981" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="36" font-weight="900" letter-spacing="-0.5">${formattedAmount}</text>
    <text x="400" y="52" text-anchor="end" fill="#34d399" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800">✓ PROVEN</text>
  </g>

  <!-- Quote / Statement Card -->
  <g transform="translate(80, 425)">
    <rect width="1040" height="96" rx="16" fill="#09090b" fill-opacity="0.6" stroke="#27272a" stroke-width="1"/>
    <text x="28" y="54" fill="#e4e4e7" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="600" font-style="italic">“${safeQuote}”</text>
  </g>

  <!-- Bottom CTA Footer -->
  <g transform="translate(80, 548)">
    <text x="0" y="16" fill="#a1a1aa" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600">Can you beat this rank? Claim your rank on lazyproof.online</text>
    <text x="1040" y="16" text-anchor="end" fill="#f59e0b" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="800">PAY TO PROVE →</text>
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
  const jsonLdString = JSON.stringify(jsonLdData, null, 2);

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

  // Replace <script type="application/ld+json">...</script>
  safeReplace(
    /<script\s+(?:id=["']schema-structured-data["']\s+)?type=["']application\/ld\+json["']>[\s\S]*?<\/script>/i,
    `<script id="schema-structured-data" type="application/ld+json">\n${jsonLdString}\n    </script>`
  );

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
    title: "LAZY — Pay to Prove You're the Laziest | Live Leaderboard",
    description: "Pay to prove you're the laziest. Public legitimacy leaderboard where higher verified payment equals higher rank. Transparent, humorous, and competitive.",
    canonicalPath: '/',
    ogType: 'website',
    breadcrumbName: 'Home'
  },
  '/about': {
    title: "About LAZY — The World's Premier Pay-to-Rank Social Experiment",
    description: "Discover the philosophy behind LAZY: transforming humorous claims into verified social proof, algorithmic ranking transparency, and shareable 9:16 proof cards.",
    canonicalPath: '/about',
    ogType: 'website',
    breadcrumbName: 'About'
  },
  '/rules': {
    title: "Official Rules & Ranking Mechanics — How LAZY Works",
    description: "Comprehensive breakdown of the LAZY rules: verified monetary bids, strict tie-breaking by timestamp, position displacement, and tamper-proof claim permanence.",
    canonicalPath: '/rules',
    ogType: 'website',
    breadcrumbName: 'Rules'
  },
  '/terms': {
    title: "Terms & Conditions — LAZY Pay-to-Rank Platform",
    description: "Official Terms & Conditions for LAZY: public leaderboard participation, verified payment processing, non-defamation conduct policies, and ranking rules.",
    canonicalPath: '/terms',
    ogType: 'website',
    breadcrumbName: 'Terms & Conditions'
  },
  '/privacy': {
    title: "Privacy Policy — How LAZY Handles Your Data",
    description: "LAZY Privacy Policy: understanding public display of names and handles, secure payment gateway processing via Razorpay, and user data rights.",
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
  '/contact': {
    title: "Contact Support & Verification Help — LAZY",
    description: "Need assistance with a verified rank claim, duplicate charge, or dispute? Contact the LAZY engineering and support team at raja@xaivon.com.",
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
    name: 'LAZY',
    url: `${baseUrl}/`,
    description: 'Public legitimacy leaderboard where higher verified payment equals higher rank.',
    inLanguage: 'en-IN',
    publisher: {
      '@type': 'Organization',
      name: 'XAIVON',
      email: 'raja@xaivon.com'
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
          operatingSystem: 'All',
          offers: {
            '@type': 'Offer',
            priceCurrency: 'INR',
            price: '1',
            availability: 'https://schema.org/InStock'
          }
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
        name: 'XAIVON',
        email: 'raja@xaivon.com',
        contactPoint: {
          '@type': 'ContactPoint',
          email: 'raja@xaivon.com',
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
  const jsonLdString = JSON.stringify(jsonLdData, null, 2);

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

  // Replace <script id="schema-structured-data" type="application/ld+json">...</script>
  safeReplace(
    /<script\s+(?:id=["']schema-structured-data["']\s+)?type=["']application\/ld\+json["']>[\s\S]*?<\/script>/i,
    `<script id="schema-structured-data" type="application/ld+json">\n${jsonLdString}\n    </script>`
  );

  return output;
}

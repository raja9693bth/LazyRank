import { UserProfile } from '../types.ts';

export interface PageSeoConfig {
  title: string;
  description: string;
  canonicalPath: string;
  ogType?: string;
  breadcrumbName?: string;
}

export const BASE_URL = 'https://lazyproof.online';

export const PAGE_SEO: Record<string, PageSeoConfig> = {
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

export function generateClientRouteJsonLd(route: string): object[] {
  const normalized = route.replace(/\/+$/, '') || '/';
  const config = PAGE_SEO[normalized] || PAGE_SEO['/'];
  const canonicalUrl = `${BASE_URL}${config.canonicalPath}`;

  const websiteNode = {
    '@type': 'WebSite',
    '@id': `${BASE_URL}/#website`,
    name: 'LAZY',
    url: `${BASE_URL}/`,
    description: 'Public legitimacy leaderboard where higher verified payment equals higher rank.',
    inLanguage: 'en-IN',
    publisher: {
      '@type': 'Organization',
      name: 'XAIVON',
      email: 'raja@xaivon.com'
    }
  };

  if (normalized === '/') {
    return [
      websiteNode,
      {
        '@type': 'WebApplication',
        '@id': `${BASE_URL}/#app`,
        name: 'LAZY',
        url: `${BASE_URL}/`,
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
    ];
  }

  const breadcrumbNode = {
    '@type': 'BreadcrumbList',
    '@id': `${canonicalUrl}#breadcrumb`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${BASE_URL}/`
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
      '@id': `${BASE_URL}/#website`
    },
    breadcrumb: {
      '@id': `${canonicalUrl}#breadcrumb`
    },
    ...extraProps
  };

  return [pageNode, breadcrumbNode, websiteNode];
}

export function updatePageSeo(path: string) {
  if (typeof document === 'undefined') return;

  const normalized = path.replace(/\/+$/, '') || '/';
  const config = PAGE_SEO[normalized] || PAGE_SEO['/'];

  // Update Title
  document.title = config.title;

  // Update or create meta description
  updateMetaTag('name', 'description', config.description);

  // Update canonical
  const canonicalUrl = `${BASE_URL}${config.canonicalPath}`;
  let linkCanonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!linkCanonical) {
    linkCanonical = document.createElement('link');
    linkCanonical.setAttribute('rel', 'canonical');
    document.head.appendChild(linkCanonical);
  }
  linkCanonical.setAttribute('href', canonicalUrl);

  // Update Open Graph
  updateMetaTag('property', 'og:title', config.title);
  updateMetaTag('property', 'og:description', config.description);
  updateMetaTag('property', 'og:url', canonicalUrl);

  // Update Twitter / X Card
  updateMetaTag('name', 'twitter:title', config.title);
  updateMetaTag('name', 'twitter:description', config.description);
  updateMetaTag('name', 'twitter:image', `${BASE_URL}/brand/lazy-avatar-light.png`);
  updateMetaTag('property', 'og:image', `${BASE_URL}/brand/lazy-avatar-light.png`);
  updateMetaTag('property', 'og:type', config.ogType || 'website');

  // Update JSON-LD structured data context-aware schema graph
  const routeGraph = generateClientRouteJsonLd(normalized);
  updateJsonLd(routeGraph);
}

export function updateProfileSeo(profile: UserProfile) {
  if (typeof document === 'undefined' || !profile) return;

  const formattedAmount = `₹${profile.amount.toLocaleString('en-IN')}`;
  const profileUrl = `${BASE_URL}/?rank=${encodeURIComponent(profile.id)}`;
  const title = `${profile.name} — Rank #${profile.rank} (${formattedAmount}) on LAZY`;
  const rawQuote = profile.roast || profile.reason || 'Paid to prove laziness. No excuses.';
  const description = `“${rawQuote.slice(0, 120)}” — ${profile.name} claimed Rank #${profile.rank} with a verified ${formattedAmount} payment on LAZY. Can you beat it?`;
  const ogImageUrl = `${BASE_URL}/api/og/card/${encodeURIComponent(profile.id)}.png`;
  const imageAlt = `${profile.name} — Rank #${profile.rank} (${formattedAmount}) Verified Proof Card on LAZY`;

  // Document Title
  document.title = title;

  // Meta description
  updateMetaTag('name', 'description', description);

  // Canonical link
  let linkCanonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!linkCanonical) {
    linkCanonical = document.createElement('link');
    linkCanonical.setAttribute('rel', 'canonical');
    document.head.appendChild(linkCanonical);
  }
  linkCanonical.setAttribute('href', profileUrl);

  // Open Graph Tags
  updateMetaTag('property', 'og:title', title);
  updateMetaTag('property', 'og:description', description);
  updateMetaTag('property', 'og:url', profileUrl);
  updateMetaTag('property', 'og:image', ogImageUrl);
  updateMetaTag('property', 'og:image:secure_url', ogImageUrl);
  updateMetaTag('property', 'og:image:type', 'image/png');
  updateMetaTag('property', 'og:image:width', '1200');
  updateMetaTag('property', 'og:image:height', '630');
  updateMetaTag('property', 'og:image:alt', imageAlt);
  updateMetaTag('property', 'og:type', 'profile');

  // Twitter / X Card Tags
  updateMetaTag('name', 'twitter:card', 'summary_large_image');
  updateMetaTag('name', 'twitter:title', title);
  updateMetaTag('name', 'twitter:description', description);
  updateMetaTag('name', 'twitter:image', ogImageUrl);
  updateMetaTag('name', 'twitter:image:alt', imageAlt);

  // Build ProfilePage JSON-LD Structured Data Graph
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

  const profileGraph = [
    {
      '@type': 'ProfilePage',
      '@id': `${profileUrl}#webpage`,
      url: profileUrl,
      name: title,
      description,
      dateCreated: profile.createdAt,
      dateModified: profile.updatedAt || profile.createdAt,
      inLanguage: 'en-IN',
      isPartOf: {
        '@type': 'WebSite',
        '@id': `${BASE_URL}/#website`,
        name: 'LAZY',
        url: `${BASE_URL}/`
      },
      mainEntity: {
        '@type': 'Person',
        '@id': `${profileUrl}#person`,
        name: profile.name,
        identifier: profile.id,
        description,
        image: ogImageUrl,
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
      '@id': `${BASE_URL}/#website`,
      name: 'LAZY',
      url: `${BASE_URL}/`,
      description: 'Public legitimacy leaderboard where higher verified payment equals higher rank.',
      inLanguage: 'en-IN',
      publisher: {
        '@type': 'Organization',
        name: 'XAIVON',
        email: 'raja@xaivon.com'
      }
    }
  ];

  updateJsonLd(profileGraph);
}

function updateJsonLd(graph: object[]) {
  if (typeof document === 'undefined') return;
  let script = document.getElementById('schema-structured-data') as HTMLScriptElement | null;
  if (!script) {
    script = document.querySelector<HTMLScriptElement>('script[type="application/ld+json"]');
  }
  if (!script) {
    script = document.createElement('script');
    script.id = 'schema-structured-data';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  } else {
    script.id = 'schema-structured-data';
  }
  script.textContent = JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@graph': graph
    },
    null,
    2
  );
}

function updateMetaTag(attributeName: 'name' | 'property', attributeValue: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attributeName}="${attributeValue}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attributeName, attributeValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

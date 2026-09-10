export interface PageSeoConfig {
  title: string;
  description: string;
  canonicalPath: string;
}

export const BASE_URL = 'https://ais-pre-hnsuuah3ujahdhbfryoao5-980673809695.asia-southeast1.run.app';

export const PAGE_SEO: Record<string, PageSeoConfig> = {
  '/': {
    title: "LAZY — Pay to Prove You're the Laziest",
    description: "Pay to prove you're the laziest. Public legitimacy leaderboard where higher verified payment equals higher rank. Transparent, humorous, and competitive.",
    canonicalPath: '/'
  },
  '/about': {
    title: "About LAZY | Pay-to-Rank Entertainment",
    description: "Learn about LAZY, the public pay-to-rank internet game. Discover the humor, the community, the 9:16 story cards, and how verified payments shape the leaderboard.",
    canonicalPath: '/about'
  },
  '/rules': {
    title: "How LAZY Works | Rules & Ranking",
    description: "Official rules for LAZY. Learn how verified payments determine your rank, how tie-breaking works, and how displacement mechanics operate.",
    canonicalPath: '/rules'
  },
  '/terms': {
    title: "LAZY Terms & Conditions | LAZY",
    description: "Official Terms & Conditions for LAZY, an entertainment-based public pay-to-rank internet game. Read our ranking mechanics, payment verification, and usage terms.",
    canonicalPath: '/terms'
  },
  '/privacy': {
    title: "LAZY Privacy Policy | LAZY",
    description: "Privacy Policy for LAZY. Learn how we collect, use, protect, and handle data submitted during leaderboard participation and payments.",
    canonicalPath: '/privacy'
  },
  '/refund-cancellation': {
    title: "LAZY Refund & Cancellation Policy | LAZY",
    description: "Clear and transparent Refund & Cancellation Policy for LAZY. Learn about cancellation before payment, failed transactions, duplicate charges, and support.",
    canonicalPath: '/refund-cancellation'
  },
  '/contact': {
    title: "Contact LAZY | Support & Payment Help",
    description: "Contact the LAZY team for payment queries, rank verification, refund assistance, or content reporting. Direct support email: raja@xaivon.com.",
    canonicalPath: '/contact'
  }
};

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

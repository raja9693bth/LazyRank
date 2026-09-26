import React from 'react';
import { renderToString } from 'react-dom/server';
import { AboutPage } from '../src/pages/AboutPage.tsx';
import { RulesPage } from '../src/pages/RulesPage.tsx';
import { TermsPage } from '../src/pages/TermsPage.tsx';
import { PrivacyPage } from '../src/pages/PrivacyPage.tsx';
import { RefundPage } from '../src/pages/RefundPage.tsx';
import { DeliveryPage } from '../src/pages/DeliveryPage.tsx';
import { ContactPage } from '../src/pages/ContactPage.tsx';
import { PricingPage } from '../src/pages/PricingPage.tsx';

/**
 * Server-side prerenderer for substantive legal and informational pages.
 * Ensures raw curl/crawlers receive full HTML content with exact business identity,
 * while React hydrates seamlessly in the browser.
 */
export function prerenderRoute(path: string): string | null {
  const normalized = path.replace(/\/+$/, '') || '/';
  const noop = () => {};

  switch (normalized) {
    case '/about':
      return renderToString(React.createElement(AboutPage, { onNavigate: noop }));
    case '/rules':
      return renderToString(React.createElement(RulesPage, { onNavigate: noop }));
    case '/terms':
      return renderToString(React.createElement(TermsPage, { onNavigate: noop }));
    case '/privacy':
      return renderToString(React.createElement(PrivacyPage, { onNavigate: noop }));
    case '/refund-cancellation':
    case '/refund':
      return renderToString(React.createElement(RefundPage, { onNavigate: noop }));
    case '/delivery':
      return renderToString(React.createElement(DeliveryPage, { onNavigate: noop }));
    case '/contact':
      return renderToString(React.createElement(ContactPage, { onNavigate: noop }));
    case '/pricing':
      return renderToString(React.createElement(PricingPage, { onNavigate: noop }));
    default:
      return null;
  }
}

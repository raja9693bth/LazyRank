/**
 * Dynamic On-Demand Cashfree Web SDK Loader
 *
 * Avoids loading third-party payment scripts on static/informational pages,
 * during headless SSR runs, or when PAYMENT_MODE=disabled.
 */

let cashfreeSdkPromise: Promise<boolean> | null = null;

export function loadCashfreeSdk(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const w = window as any;
  if (typeof w.Cashfree === 'function') return Promise.resolve(true);
  if (cashfreeSdkPromise !== null) return cashfreeSdkPromise;

  cashfreeSdkPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[src*="sdk.cashfree.com"]') as HTMLScriptElement | null;
    if (existing) {
      if (typeof (window as any).Cashfree === 'function') {
        resolve(true);
      } else {
        existing.addEventListener('load', () => resolve(true), { once: true });
        existing.addEventListener('error', () => resolve(false), { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;
    script.onload = () => {
      resolve(typeof (window as any).Cashfree === 'function');
    };
    script.onerror = () => {
      console.warn('[Cashfree SDK] Failed to load Cashfree Web SDK on demand.');
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return cashfreeSdkPromise;
}

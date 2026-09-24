import { PaymentProvider } from './provider.ts';
import { CashfreeProvider } from './cashfree.ts';

export type PaymentMode = 'disabled' | 'sandbox' | 'live';

export class PaymentManager {
  private mode: PaymentMode;
  private provider: PaymentProvider;

  constructor() {
    const rawMode = (process.env.PAYMENT_MODE || 'disabled').toLowerCase().trim();
    if (rawMode === 'live') {
      this.mode = 'live';
    } else if (rawMode === 'sandbox') {
      this.mode = 'sandbox';
    } else {
      this.mode = 'disabled';
    }

    const isProd = process.env.NODE_ENV === 'production';

    // Section 7: Production + sandbox = forbidden!
    if (isProd && this.mode === 'sandbox') {
      throw new Error(
        'FATAL CONFIGURATION ERROR: PAYMENT_MODE=sandbox is strictly forbidden in a production environment.'
      );
    }

    // Default primary provider is Cashfree
    this.provider = new CashfreeProvider({
      isSandbox: this.mode === 'sandbox'
    });

    // In live mode, verify required credentials exist
    if (this.mode === 'live') {
      const hasAppId = Boolean(process.env.CASHFREE_APP_ID?.trim());
      const hasSecretKey = Boolean(process.env.CASHFREE_SECRET_KEY?.trim());
      if (!hasAppId || !hasSecretKey) {
        console.warn(
          '[PaymentManager] WARNING: PAYMENT_MODE=live is configured, but CASHFREE_APP_ID or CASHFREE_SECRET_KEY is missing. Payments will be safely disabled until credentials are provided.'
        );
        this.mode = 'disabled';
      }
    }
  }

  public getMode(): PaymentMode {
    return this.mode;
  }

  public isEnabled(): boolean {
    return this.mode !== 'disabled';
  }

  public getProvider(): PaymentProvider {
    return this.provider;
  }
}

export const paymentManager = new PaymentManager();

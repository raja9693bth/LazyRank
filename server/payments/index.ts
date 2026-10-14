import { PaymentProvider } from './provider.ts';
import { CashfreeProvider } from './cashfree.ts';
import { DodoPaymentsProvider } from './dodo.ts';

function sanitizeLog(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  return str.replace(/[\r\n\t]/g, '_').slice(0, 500);
}

export type PaymentMode = 'disabled' | 'sandbox' | 'live';
export type PaymentProviderType = 'cashfree' | 'dodo';

export class PaymentManager {
  private mode: PaymentMode;
  private providerName: PaymentProviderType;
  private provider: PaymentProvider;
  private cashfreeProvider: CashfreeProvider;
  private dodoProvider: DodoPaymentsProvider;

  constructor() {
    this.mode = 'disabled';
    this.providerName = 'cashfree';
    this.cashfreeProvider = new CashfreeProvider();
    this.dodoProvider = new DodoPaymentsProvider();
    this.provider = this.cashfreeProvider;
    this.reload();
  }

  public reload(): void {
    const rawMode = (process.env.PAYMENT_MODE || 'disabled').toLowerCase().trim();
    if (rawMode === 'live') {
      this.mode = 'live';
    } else if (rawMode === 'sandbox') {
      this.mode = 'sandbox';
    } else {
      this.mode = 'disabled';
    }

    const isProd = process.env.NODE_ENV === 'production';

    // Production + sandbox = forbidden!
    if (isProd && this.mode === 'sandbox') {
      throw new Error(
        'FATAL CONFIGURATION ERROR: PAYMENT_MODE=sandbox is strictly forbidden in a production environment.'
      );
    }

    const rawProvider = (process.env.PAYMENT_PROVIDER || 'cashfree').toLowerCase().trim();
    this.providerName = rawProvider === 'dodo' ? 'dodo' : 'cashfree';

    this.cashfreeProvider = new CashfreeProvider({
      isSandbox: this.mode === 'sandbox'
    });

    this.dodoProvider = new DodoPaymentsProvider({
      isTestMode: this.mode === 'sandbox'
    });

    if (this.providerName === 'dodo') {
      this.provider = this.dodoProvider;
      if (this.mode === 'live') {
        const hasApiKey = Boolean(process.env.DODO_PAYMENTS_API_KEY?.trim());
        const hasWebhookKey = Boolean(process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim());
        if (!hasApiKey || !hasWebhookKey) {
          console.warn(
            '[PaymentManager] WARNING: PAYMENT_MODE=live is configured with PAYMENT_PROVIDER=dodo, but DODO_PAYMENTS_API_KEY or DODO_PAYMENTS_WEBHOOK_KEY is missing. Payments will be safely disabled until credentials are provided.'
          );
          this.mode = 'disabled';
        }
      }
    } else {
      this.provider = this.cashfreeProvider;
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
  }

  public getMode(): PaymentMode {
    return this.mode;
  }

  public isEnabled(): boolean {
    return this.mode !== 'disabled';
  }

  public getProviderName(): PaymentProviderType {
    return this.providerName;
  }

  public getProvider(): PaymentProvider {
    return this.provider;
  }

  /**
   * Provider-aware lookup: Returns the designated provider instance for a specific order.
   * Preserves backward compatibility and historical Cashfree reconciliation.
   */
  public getProviderFor(providerName?: string): PaymentProvider {
    const clean = (providerName || '').toLowerCase().trim();
    if (clean === 'dodo') {
      return this.dodoProvider;
    }
    if (clean === 'cashfree') {
      return this.cashfreeProvider;
    }
    return this.provider;
  }
}

export const paymentManager = new PaymentManager();

import { PaymentProvider } from './provider.ts';
import { CashfreeProvider } from './cashfree.ts';
import { DodoPaymentsProvider } from './dodo.ts';
import { RazorpayProvider } from './razorpay.ts';
import { getPricingCapabilities, PricingCapabilitiesResponse } from './pricingPolicy.ts';

function sanitizeLog(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  return str.replace(/[\r\n\t]/g, '_').slice(0, 500);
}

export type PaymentMode = 'disabled' | 'sandbox' | 'live';
export type PaymentProviderType = 'cashfree' | 'dodo' | 'razorpay';

export interface PublicPaymentConfig {
  enabled: boolean;
  mode: PaymentMode;
  provider: PaymentProviderType;
  taxReady: boolean;
  taxDisclosure: string;
  razorpayKeyId?: string;
  capabilities: PricingCapabilitiesResponse;
}

export class PaymentManager {
  private mode: PaymentMode;
  private providerName: PaymentProviderType;
  private provider: PaymentProvider;
  private cashfreeProvider: CashfreeProvider;
  private dodoProvider: DodoPaymentsProvider;
  private razorpayProvider: RazorpayProvider;
  private usdEnabled: boolean = false;
  public enabledProviders: PaymentProviderType[] = ['dodo'];

  constructor() {
    this.mode = 'disabled';
    this.providerName = 'dodo';
    this.cashfreeProvider = new CashfreeProvider();
    this.dodoProvider = new DodoPaymentsProvider();
    this.razorpayProvider = new RazorpayProvider();
    this.provider = this.dodoProvider;
    this.reload();
  }

  public reload(): void {
    const rawProviders = process.env.PAYMENT_ENABLED_PROVIDERS?.trim();
    if (rawProviders) {
      this.enabledProviders = rawProviders.split(',').map(p => p.trim().toLowerCase()) as PaymentProviderType[];
    }
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

    // Check environment conflict: live mode with test_mode Dodo environment
    const rawDodoEnv = (process.env.DODO_PAYMENTS_ENVIRONMENT || '').toLowerCase().trim();
    if (this.mode === 'live' && rawDodoEnv === 'test_mode') {
      console.warn(
        '[PaymentManager] SECURITY VIOLATION: PAYMENT_MODE=live cannot be paired with DODO_PAYMENTS_ENVIRONMENT=test_mode. Payments will be safely disabled.'
      );
      this.mode = 'disabled';
    }

    const rawProvider = (process.env.PAYMENT_PROVIDER || 'dodo').toLowerCase().trim();
    if (rawProvider === 'dodo') {
      this.providerName = 'dodo';
    } else if (rawProvider === 'razorpay') {
      this.providerName = 'razorpay';
    } else if (rawProvider === 'cashfree') {
      this.providerName = 'cashfree';
    } else {
      console.warn(`[PaymentManager] Unknown provider "${rawProvider}". Defaulting to disabled.`);
      this.providerName = 'dodo';
      this.mode = 'disabled';
    }

    this.cashfreeProvider = new CashfreeProvider({
      isSandbox: this.mode === 'sandbox'
    });

    this.dodoProvider = new DodoPaymentsProvider({
      isTestMode: this.mode === 'sandbox'
    });

    this.razorpayProvider = new RazorpayProvider({
      isSandbox: this.mode === 'sandbox'
    });

    // Check USD capability: enabled only if explicit USD credentials & live capability verified
    const rawUsd = (process.env.DODO_USD_ENABLED || 'false').toLowerCase().trim();
    this.usdEnabled = rawUsd === 'true';

    // Set primary provider
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
    } else if (this.providerName === 'razorpay') {
      this.provider = this.razorpayProvider;
      if (this.mode === 'live') {
        const isLiveEnabled = this.razorpayProvider.isLiveEnabled();
        if (!isLiveEnabled) {
          console.warn(
            '[PaymentManager] WARNING: PAYMENT_PROVIDER=razorpay is selected for live, but RAZORPAY_ENABLED is false or keys are missing. Safely falling back to dodo or disabled.'
          );
          // If Dodo is configured, use Dodo as fallback, otherwise disabled
          if (this.dodoProvider.isConfigured()) {
            this.provider = this.dodoProvider;
            this.providerName = 'dodo';
          } else {
            this.mode = 'disabled';
          }
        }
      }
    } else {
      this.provider = this.cashfreeProvider;
      if (this.mode === 'live') {
        const hasAppId = Boolean(process.env.CASHFREE_APP_ID?.trim());
        const hasSecretKey = Boolean(process.env.CASHFREE_SECRET_KEY?.trim());
        if (!hasAppId || !hasSecretKey) {
          console.warn(
            '[PaymentManager] WARNING: PAYMENT_MODE=live is configured with cashfree, but keys are missing. Payments disabled.'
          );
          this.mode = 'disabled';
        }
      }
    }

    // Checkout master switch: controls NEW orders only
    const checkoutEnabled = (process.env.CHECKOUT_ENABLED || 'true').toLowerCase().trim();
    this.checkoutEnabled = checkoutEnabled !== 'false';
  }

  private checkoutEnabled: boolean = true;

  public getMode(): PaymentMode {
    return this.mode;
  }

  public isEnabled(): boolean {
    return this.mode !== 'disabled' && this.checkoutEnabled;
  }

  public isCheckoutEnabled(): boolean {
    return this.checkoutEnabled;
  }

  public isUsdEnabled(): boolean {
    return this.usdEnabled;
  }

  public getProviderName(): PaymentProviderType {
    return this.providerName;
  }

  public getProvider(): PaymentProvider {
    return this.provider;
  }

  public getDodoProvider(): DodoPaymentsProvider {
    return this.dodoProvider;
  }

  public getRazorpayProvider(): RazorpayProvider {
    return this.razorpayProvider;
  }

  public getCashfreeProvider(): CashfreeProvider {
    return this.cashfreeProvider;
  }

  /**
   * Checks if a NEW order may be initiated.
   * Gated by checkoutEnabled, provider readiness, allowlist, and currency readiness.
   */
  public mayCreateNewOrder(providerName?: string, currency: string = 'INR'): boolean {
    if (this.mode === 'disabled') return false;
    if (!this.checkoutEnabled) return false;

    const cur = currency.toUpperCase().trim();
    if (cur === 'USD' && !this.usdEnabled) return false;

    const prov = (providerName || this.providerName).toLowerCase().trim() as PaymentProviderType;
    // Cashfree is retired from public new-order checkout in live / production
    if (prov === 'cashfree' && (this.mode === 'live' || process.env.NODE_ENV === 'production')) {
      return false;
    }

    // Enforce allowlist in live mode
    if (this.mode === 'live' && !this.enabledProviders.includes(prov)) return false;

    if (prov === 'cashfree') {
      return this.mode === 'sandbox';
    }
    if (prov === 'razorpay') {
      return this.mode === 'sandbox' || this.razorpayProvider.isLiveEnabled();
    }
    if (prov === 'dodo') {
      return this.mode === 'sandbox' || this.dodoProvider.isConfigured();
    }
    return false;
  }

  /**
   * Checks if an EXISTING order can be verified or polled.
   * Does NOT depend on checkoutEnabled.
   */
  public mayVerifyExistingOrder(orderOrProviderName?: string | { provider?: string; [key: string]: any } | any): boolean {
    const provName = typeof orderOrProviderName === 'string'
      ? orderOrProviderName
      : (orderOrProviderName && typeof orderOrProviderName === 'object' ? (orderOrProviderName as any).provider : undefined) || this.providerName;
    const prov = (provName || this.providerName).toLowerCase().trim();
    const isTest = process.env.NODE_ENV !== 'production' || this.mode === 'sandbox';
    if (prov === 'dodo') return this.dodoProvider.isConfigured() || isTest;
    if (prov === 'razorpay') return this.razorpayProvider.isConfigured() || isTest;
    if (prov === 'cashfree') return this.cashfreeProvider.isConfigured() || isTest;
    return true;
  }

  /**
   * Checks if an incoming webhook can be processed for existing liabilities.
   * Does NOT depend on checkoutEnabled.
   */
  public mayProcessWebhook(_providerName?: string): boolean {
    return true;
  }

  /**
   * Checks if existing payments/refunds can be reconciled.
   * Does NOT depend on checkoutEnabled.
   */
  public mayReconcileExistingPayment(_orderOrProviderName?: string | { provider?: string; [key: string]: any } | any): boolean {
    return true;
  }

  /**
   * Checks if an authorized refund can be initiated on an existing order.
   * Does NOT depend on checkoutEnabled.
   */
  public mayInitiateAuthorizedRefund(orderOrProviderName?: string | { provider?: string; [key: string]: any } | any): boolean {
    const provName = typeof orderOrProviderName === 'string'
      ? orderOrProviderName
      : (orderOrProviderName && typeof orderOrProviderName === 'object' ? (orderOrProviderName as any).provider : undefined) || this.providerName;
    const prov = (provName || this.providerName).toLowerCase().trim();
    const isTest = process.env.NODE_ENV !== 'production' || this.mode === 'sandbox';
    if (prov === 'dodo') return this.dodoProvider.isConfigured() || isTest;
    if (prov === 'razorpay') return this.razorpayProvider.isConfigured() || isTest;
    if (prov === 'cashfree') return this.cashfreeProvider.isConfigured() || isTest;
    return false;
  }

  /**
   * Provider-aware lookup (Sticky Orders):
   * Strictly returns the designated provider instance for a specific order.
   * A provider switch never mutates or reroutes an existing order's reconciliation or refunds.
   * Unknown providers fail explicitly and NEVER fall back to current primary!
   */
  public getProviderFor(providerName?: string): PaymentProvider {
    const clean = (providerName || this.providerName || '').toLowerCase().trim();
    if (clean === 'dodo') {
      return this.dodoProvider;
    }
    if (clean === 'razorpay') {
      return this.razorpayProvider;
    }
    if (clean === 'cashfree') {
      return this.cashfreeProvider;
    }
    throw new Error(`Unknown or unsupported payment provider "${providerName}". Cannot resolve provider for existing order.`);
  }

  /**
   * Currency capability routing:
   * Chooses a supported provider for a new intent before creation, then pins it.
   * If Razorpay is primary (INR only), route a requested USD intent to Dodo.
   */
  public getProviderForIntent(currency: string = 'INR'): PaymentProvider {
    const cur = currency.toUpperCase().trim();
    if (cur === 'USD') {
      if (this.dodoProvider.isConfigured() || this.mode === 'sandbox') {
        return this.dodoProvider;
      }
    }
    return this.provider;
  }

  /**
   * Return sanitized public config for /api/payment/config
   */
  public getPublicConfig(): PublicPaymentConfig {
    return {
      enabled: this.mayCreateNewOrder(this.providerName),
      mode: this.mode,
      provider: this.providerName,
      taxReady: true,
      taxDisclosure: 'Tax-inclusive pricing (Section 22 CGST Act / Dodo MoR)',
      razorpayKeyId: this.providerName === 'razorpay' ? this.razorpayProvider.getKeyId() : undefined,
      capabilities: getPricingCapabilities(this.usdEnabled)
    };
  }
}

export const paymentManager = new PaymentManager();

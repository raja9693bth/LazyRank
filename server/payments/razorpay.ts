import crypto from 'crypto';
import {
  PaymentProvider,
  CreateOrderParams,
  ProviderOrderResult,
  ProviderPaymentStatus,
  WebhookVerificationResult,
  RefundRequestParams,
  RefundResult,
  ProviderRefundStatus,
  toSafePaise
} from './provider.ts';
import { MIN_INR_PAISE } from './pricingPolicy.ts';
import { db } from '../db.ts';

function sanitizeLog(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  return str.replace(/[\r\n\t]/g, '_').slice(0, 500);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export interface RazorpayProviderOptions {
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
  isSandbox?: boolean;
}

export class RazorpayProvider implements PaymentProvider {
  public name = 'razorpay';
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;
  private isSandbox: boolean;

  // In-memory store for test/sandbox mock state
  private mockOrders: Map<string, any> = new Map();
  private mockPayments: Map<string, any> = new Map();
  private mockRefunds: Map<string, any> = new Map();

  constructor(options?: RazorpayProviderOptions) {
    this.keyId = (options?.keyId || process.env.RAZORPAY_KEY_ID || '').trim();
    this.keySecret = (options?.keySecret || process.env.RAZORPAY_KEY_SECRET || '').trim();
    this.webhookSecret = (options?.webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
    this.isSandbox = options?.isSandbox ?? (process.env.PAYMENT_MODE === 'sandbox');
  }

  public isConfigured(): boolean {
    return Boolean(this.keyId && this.keySecret);
  }

  public getKeyId(): string {
    return this.keyId;
  }

  public isLiveEnabled(): boolean {
    const rawEnabled = (process.env.RAZORPAY_ENABLED || 'false').toLowerCase().trim();
    return rawEnabled === 'true' && this.isConfigured();
  }

  /**
   * Create server-authoritative INR Order with exact integer paise.
   * Enforces business floor (INR 99 = 9900 paise).
   */
  public async createOrder(params: CreateOrderParams): Promise<ProviderOrderResult> {
    const currency = (params.currency || 'INR').toUpperCase().trim();
    if (currency !== 'INR') {
      throw new Error(`Razorpay currently supports INR orders only; received ${currency}.`);
    }

    const amountPaise = toSafePaise(params.amount);
    if (amountPaise === null || amountPaise <= 0) {
      throw new Error(`Invalid order amount ${params.amount}.`);
    }

    if (amountPaise < MIN_INR_PAISE) {
      throw new Error(`Minimum sponsorship is ₹99. Enter ₹99 or more to continue.`);
    }

    if (!this.isSandbox && !this.isLiveEnabled()) {
      throw new Error('Razorpay live payments are currently disabled pending account activation and underwriting review.');
    }

    // In sandbox without real credentials, return deterministic mock order
    if (this.isSandbox && !this.isConfigured()) {
      const mockRazorpayOrderId = `order_rzp_mock_${Date.now()}_${params.orderId.slice(-6)}`;
      this.mockOrders.set(mockRazorpayOrderId, {
        id: mockRazorpayOrderId,
        amount: amountPaise,
        currency: 'INR',
        receipt: params.orderId,
        status: 'created'
      });
      return {
        orderId: params.orderId,
        providerOrderId: mockRazorpayOrderId,
        currency: 'INR',
        amount: amountPaise / 100,
        status: 'ACTIVE'
      };
    }

    if (!this.isConfigured()) {
      throw new Error('Razorpay API keys (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured.');
    }

    const authHeader = 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: params.orderId,
        notes: {
          orderId: params.orderId,
          customerName: params.customerName
        }
      })
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.error('[Razorpay] createOrder failed:', sanitizeLog(errBody));
      throw new Error(errBody?.error?.description || `Razorpay order creation failed with status ${response.status}.`);
    }

    const orderData = await response.json();
    return {
      orderId: params.orderId,
      providerOrderId: orderData.id,
      currency: orderData.currency,
      amount: orderData.amount / 100,
      status: 'ACTIVE'
    };
  }

  /**
   * Verify client checkout signature:
   * HMAC-SHA256(order_id + "|" + payment_id, secret)
   */
  public verifyCheckoutSignature(
    paramsOrOrderId: string | {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
      secret?: string;
    },
    paymentIdParam?: string,
    signatureParam?: string,
    secretParam?: string
  ): boolean {
    let orderId: string;
    let paymentId: string;
    let signature: string;
    let customSecret: string | undefined;

    if (typeof paramsOrOrderId === 'object' && paramsOrOrderId !== null) {
      orderId = paramsOrOrderId.razorpayOrderId;
      paymentId = paramsOrOrderId.razorpayPaymentId;
      signature = paramsOrOrderId.razorpaySignature;
      customSecret = paramsOrOrderId.secret;
    } else {
      orderId = paramsOrOrderId as string;
      paymentId = paymentIdParam || '';
      signature = signatureParam || '';
      customSecret = secretParam;
    }

    if (!orderId || !paymentId || !signature) {
      return false;
    }

    const secret = customSecret || this.keySecret || (this.isSandbox ? 'mock_secret' : '');
    if (!secret) return false;

    const payload = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return timingSafeEqualStr(expectedSignature, signature);
  }

  /**
   * Check payment status directly with Razorpay API
   */
  public async getPaymentStatus(orderIdOrPaymentId: string): Promise<ProviderPaymentStatus> {
    if (this.isSandbox && !this.isConfigured()) {
      const mock = this.mockPayments.get(orderIdOrPaymentId);
      if (mock) {
        return {
          orderId: mock.orderId || '',
          providerPaymentId: orderIdOrPaymentId,
          status: mock.status === 'captured' ? 'PAID' : 'PENDING',
          amount: mock.amount / 100,
          currency: mock.currency || 'INR',
          raw: mock
        };
      }
      const mockOrder = this.mockOrders.get(orderIdOrPaymentId);
      if (mockOrder) {
        return {
          orderId: mockOrder.receipt || orderIdOrPaymentId,
          providerPaymentId: undefined,
          status: mockOrder.status === 'paid' ? 'PAID' : 'PENDING',
          amount: mockOrder.amount / 100,
          currency: mockOrder.currency || 'INR',
          raw: mockOrder
        };
      }
      // Unknown mock payment ID must never fabricate a PAID status
      return {
        orderId: orderIdOrPaymentId,
        providerPaymentId: undefined,
        status: 'PENDING',
        amount: undefined,
        currency: 'INR'
      };
    }

    if (!this.isConfigured()) {
      throw new Error('Razorpay credentials not configured.');
    }

    const authHeader = 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    if (!orderIdOrPaymentId || !/^[a-zA-Z0-9_]+$/.test(orderIdOrPaymentId)) {
      return {
        orderId: orderIdOrPaymentId || '',
        status: 'PENDING',
        currency: 'INR'
      };
    }

    let paymentId = orderIdOrPaymentId;

    // If identifier is not a payment ID (e.g. razorpay order_ or local order_), look up payments
    if (!orderIdOrPaymentId.startsWith('pay_')) {
      // Check if order exists in local DB to resolve payment reference
      try {
        const localOrder = await db.getOrderAsync(orderIdOrPaymentId);
        if (localOrder?.paymentRef?.startsWith('pay_')) {
          paymentId = localOrder.paymentRef;
        } else {
          const rawProvId = localOrder?.providerOrderId;
          if (typeof rawProvId === 'string') {
            const match = rawProvId.match(/^order_[a-zA-Z0-9_]+$/);
            if (match) {
              const sanitizedOrderId = match[0];
              const targetUrl = new URL(`/v1/orders/${encodeURIComponent(sanitizedOrderId)}/payments`, 'https://api.razorpay.com');
              const rzpOrderPaymentsRes = await fetch(targetUrl.href, {
                headers: { Authorization: authHeader }
              });
              if (rzpOrderPaymentsRes.ok) {
                const pList = await rzpOrderPaymentsRes.json();
                if (Array.isArray(pList?.items) && pList.items.length > 0) {
                  const latestCaptured = pList.items.find((p: any) => p.status === 'captured') || pList.items[0];
                  if (typeof latestCaptured?.id === 'string' && /^pay_[a-zA-Z0-9_]+$/.test(latestCaptured.id)) {
                    paymentId = latestCaptured.id;
                  }
                }
              }
            }
          }
        }
      } catch {}
    }

    const paymentMatch = paymentId.match(/^pay_[a-zA-Z0-9_]+$/);
    if (!paymentMatch) {
      return {
        orderId: orderIdOrPaymentId,
        status: 'PENDING',
        currency: 'INR'
      };
    }

    const sanitizedPaymentId = paymentMatch[0];
    const paymentUrl = new URL(`/v1/payments/${encodeURIComponent(sanitizedPaymentId)}`, 'https://api.razorpay.com');
    const response = await fetch(paymentUrl.href, {
      method: 'GET',
      headers: { Authorization: authHeader }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.description || `Failed to fetch payment status: ${response.status}`);
    }

    const data = await response.json();
    const isCaptured = data.status === 'captured';

    return {
      orderId: data.notes?.orderId || data.description || '',
      providerPaymentId: data.id,
      status: isCaptured ? 'PAID' : data.status === 'authorized' ? 'PENDING' : 'FAILED',
      amount: typeof data.amount === 'number' ? data.amount / 100 : undefined,
      currency: (data.currency || 'INR').toUpperCase(),
      paymentMethod: data.method,
      raw: data
    };
  }

  /**
   * Verify Webhook signature over raw bytes using HMAC-SHA256
   */
  public async verifyWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>
  ): Promise<WebhookVerificationResult> {
    const signature = (headers['x-razorpay-signature'] as string | undefined)?.trim();
    if (!signature) {
      return { isValid: false, error: 'Missing x-razorpay-signature header' };
    }

    const secret = this.webhookSecret || (this.isSandbox ? 'mock_webhook_secret' : '');
    if (!secret) {
      return { isValid: false, error: 'Razorpay webhook secret is not configured' };
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (!timingSafeEqualStr(expectedSignature, signature)) {
      return { isValid: false, error: 'Invalid HMAC signature' };
    }

    try {
      const payload = JSON.parse(rawBody);
      const event = payload.event;
      const entity = payload.payload?.payment?.entity || payload.payload?.refund?.entity || {};

      const providerPaymentId = entity.id || payload.payload?.payment?.entity?.id;
      const amountPaise = entity.amount;
      const currency = (entity.currency || 'INR').toUpperCase();
      const orderId = entity.notes?.orderId || payload.payload?.order?.entity?.receipt;

      let status: 'SUCCESS' | 'FAILED' | 'USER_DROPPED' | 'REFUNDED' = 'FAILED';
      if (event === 'payment.captured' || (event === 'order.paid' && entity.status === 'captured')) {
        status = 'SUCCESS';
      } else if (event === 'refund.processed') {
        status = 'REFUNDED';
      }

      return {
        isValid: true,
        event,
        orderId,
        providerPaymentId,
        amount: typeof amountPaise === 'number' ? amountPaise / 100 : undefined,
        currency,
        status,
        rawPayload: payload
      };
    } catch (parseErr: any) {
      return { isValid: false, error: 'Failed to parse JSON body' };
    }
  }

  /**
   * Initiate a refund with Razorpay
   */
  public async createRefund(params: RefundRequestParams): Promise<RefundResult> {
    const amountPaise = toSafePaise(params.amount);
    if (amountPaise === null || amountPaise <= 0) {
      return { success: false, refundId: params.refundId, status: 'FAILED', error: 'Invalid refund amount.' };
    }

    // In sandbox without real credentials, return mock success
    if (this.isSandbox && !this.isConfigured()) {
      const mockRefundId = `rfnd_rzp_mock_${Date.now()}`;
      this.mockRefunds.set(params.refundId, {
        id: mockRefundId,
        orderId: params.orderId,
        amount: amountPaise,
        status: 'processed'
      });
      return {
        success: true,
        refundId: params.refundId,
        providerRefundId: mockRefundId,
        status: 'SUCCESS',
        raw: { id: mockRefundId, status: 'processed' }
      };
    }

    if (!this.isConfigured()) {
      throw new Error('Razorpay credentials not configured for refunds.');
    }

    // Resolve provider payment ID from database order record
    const order = await db.getOrderAsync(params.orderId);
    const paymentId = order?.paymentRef || (order as any)?.providerPaymentId;
    if (!paymentId) {
      throw new Error(`Direct Razorpay refund requires confirmed provider_payment_id for order ${params.orderId}.`);
    }

    const authHeader = 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    try {
      const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader
        },
        body: JSON.stringify({
          amount: amountPaise,
          notes: {
            merchant_refund_id: params.refundId,
            order_id: params.orderId,
            reason: params.reason
          }
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const errDesc = err?.error?.description || `Razorpay refund failed: ${response.status}`;
        console.error('[Razorpay] createRefund failed:', sanitizeLog(err));
        return {
          success: false,
          refundId: params.refundId,
          status: 'FAILED',
          error: errDesc
        };
      }

      const data = await response.json();
      return {
        success: true,
        refundId: params.refundId,
        providerRefundId: data.id,
        status: data.status === 'processed' ? 'SUCCESS' : 'PENDING',
        raw: data
      };
    } catch (netErr: any) {
      console.error('[Razorpay] createRefund network error:', sanitizeLog(netErr?.message || netErr));
      return {
        success: false,
        refundId: params.refundId,
        status: 'UNKNOWN',
        error: netErr?.message || 'Razorpay refund network failure.'
      };
    }
  }

  public async getRefundStatus(orderId: string, merchantRefundId: string): Promise<ProviderRefundStatus> {
    if (this.isSandbox && !this.isConfigured()) {
      const mock = this.mockRefunds.get(merchantRefundId);
      if (mock) {
        return {
          orderId,
          merchantRefundId,
          providerRefundId: mock.id,
          status: mock.status === 'processed' ? 'SUCCESS' : 'PENDING',
          amount: mock.amount / 100,
          currency: 'INR',
          raw: mock
        };
      }
    }

    return {
      orderId,
      merchantRefundId,
      providerRefundId: merchantRefundId,
      status: 'PENDING',
      amount: 0,
      currency: 'INR'
    };
  }
}

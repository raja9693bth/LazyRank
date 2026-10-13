import crypto from 'crypto';
import DodoPayments from 'dodopayments';
import { Webhook } from 'standardwebhooks';
import {
  PaymentProvider,
  CreateOrderParams,
  ProviderOrderResult,
  ProviderPaymentStatus,
  WebhookVerificationResult,
  RefundRequestParams,
  RefundResult,
  RefundWebhookDetails,
  ProviderRefundStatus,
  toSafePaise
} from './provider.ts';
import { db } from '../db.ts';

function sanitizeLog(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  return str.replace(/[\r\n\t]/g, '_').slice(0, 500);
}

export interface DodoProviderOptions {
  apiKey?: string;
  webhookKey?: string;
  environment?: 'test_mode' | 'live_mode';
  productId?: string;
  isTestMode?: boolean;
}

export class DodoPaymentsProvider implements PaymentProvider {
  public name = 'dodo';
  private apiKey: string;
  private webhookKey: string;
  private environment: 'test_mode' | 'live_mode';
  private configuredProductId?: string;
  private client?: DodoPayments;
  private webhookVerifier?: Webhook;

  // In-memory cache for fixed-price products: amountPaise -> productId
  private productCache: Map<number, string> = new Map();
  // Mutex to protect concurrent creation of products for the same amount
  private inFlightCreations: Map<number, Promise<string>> = new Map();
  // Order to session and payment lookup cache
  private orderSessions: Map<string, string> = new Map();
  private orderPayments: Map<string, string> = new Map();

  constructor(options?: DodoProviderOptions) {
    this.apiKey = (options?.apiKey || process.env.DODO_PAYMENTS_API_KEY || '').trim();
    this.webhookKey = (options?.webhookKey || process.env.DODO_PAYMENTS_WEBHOOK_KEY || '').trim();
    this.configuredProductId = (options?.productId || process.env.DODO_PRODUCT_ID || '').trim() || undefined;

    const rawEnv = (process.env.DODO_PAYMENTS_ENVIRONMENT || '').toLowerCase().trim();
    if (rawEnv === 'live_mode') {
      this.environment = 'live_mode';
    } else if (rawEnv === 'test_mode') {
      this.environment = 'test_mode';
    } else {
      this.environment = options?.isTestMode ?? (process.env.PAYMENT_MODE === 'sandbox') ? 'test_mode' : 'live_mode';
    }

    if (this.apiKey) {
      try {
        this.client = new DodoPayments({
          bearerToken: this.apiKey,
          environment: this.environment
        });
      } catch (err: any) {
        console.warn('[Dodo] Client initialization warning:', sanitizeLog(err?.message || err));
      }
    }

    if (this.webhookKey) {
      try {
        this.webhookVerifier = new Webhook(this.webhookKey);
      } catch (err: any) {
        console.warn('[Dodo] Webhook verifier initialization warning:', sanitizeLog(err?.message || err));
      }
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.webhookKey);
  }

  public getEnvironment(): 'test_mode' | 'live_mode' {
    return this.environment;
  }

  public getClient(): DodoPayments | undefined {
    return this.client;
  }

  /**
   * Resolve or safely create a fixed-price INR product for the required amount (in minor-unit paise).
   * Strategy: Fixed-price INR products with quantity = 1.
   * Truthfully describes a single digital service profile sponsorship without misleading 'credits' or multi-unit counts.
   */
  public async resolveProductForAmount(amountINR: number): Promise<string> {
    if (this.configuredProductId) {
      return this.configuredProductId;
    }

    const amountPaise = toSafePaise(amountINR);
    if (amountPaise === null || amountPaise <= 0) {
      throw new Error(`Invalid payment amount ${amountINR} INR.`);
    }

    // Check in-memory cache
    const cached = this.productCache.get(amountPaise);
    if (cached) {
      return cached;
    }

    // Check if another concurrent request is currently creating the product for this amount
    const inFlight = this.inFlightCreations.get(amountPaise);
    if (inFlight) {
      return await inFlight;
    }

    if (!this.client) {
      throw new Error('Dodo Payments client is not initialized.');
    }

    const creationPromise = (async () => {
      try {
        const product = await this.client!.products.create({
          name: `LazyProof Verified Placement - ₹${amountINR}`,
          description: `Verified public leaderboard digital placement on LazyProof (operated by ADABHRA GROUP). Amount: ₹${amountINR} INR`,
          tax_category: 'digital_products',
          price: {
            type: 'one_time_price',
            currency: 'INR',
            price: amountPaise
          }
        });

        if (!product?.product_id) {
          throw new Error('Dodo product creation did not return a product_id.');
        }

        this.productCache.set(amountPaise, product.product_id);
        return product.product_id;
      } catch (err: any) {
        console.error('[Dodo] Failed to create fixed-price product for %d paise: %s', amountPaise, sanitizeLog(err?.message || err));
        throw new Error(err?.message || `Failed to create fixed-price product for ₹${amountINR}`);
      }
    })();

    this.inFlightCreations.set(amountPaise, creationPromise);
    try {
      return await creationPromise;
    } finally {
      this.inFlightCreations.delete(amountPaise);
    }
  }

  /**
   * Create Checkout Session for the order with INR pricing and atomic tracking
   */
  public async createOrder(params: CreateOrderParams): Promise<ProviderOrderResult> {
    if (!this.isConfigured()) {
      throw new Error('Dodo Payments credentials are not configured.');
    }

    if (!this.client) {
      throw new Error('Dodo Payments client is not available.');
    }

    if (!Number.isInteger(params.amount)) {
      throw new Error('Dodo Payments requires whole integer INR amounts.');
    }

    // Dodo Payments minimum transaction threshold for INR is ₹5.00
    if (params.amount < 5) {
      throw new Error('Dodo Payments requires a minimum purchase amount of ₹5.');
    }

    if (params.amount > 1000000) {
      throw new Error('Payment amount exceeds maximum limit of ₹10,00,000.');
    }

    const productId = await this.resolveProductForAmount(params.amount);
    const returnUrl = params.returnUrl || `https://lazyproof.online/?order_id=${encodeURIComponent(params.orderId)}&status=return`;
    const idempotencyKey = params.idempotencyKey || `idem_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    const customerDetails: any = {
      name: params.customerName.slice(0, 50)
    };
    if (params.customerEmail && params.customerEmail.trim()) {
      customerDetails.email = params.customerEmail.trim();
    }
    if (params.customerPhone && params.customerPhone.trim()) {
      customerDetails.phone_number = params.customerPhone.trim();
    }

    const session = await this.client.checkoutSessions.create({
      product_cart: [
        {
          product_id: productId,
          quantity: 1
        }
      ],
      return_url: returnUrl,
      customer: customerDetails,
      metadata: {
        order_id: params.orderId,
        idempotency_key: idempotencyKey,
        customer_name: params.customerName.slice(0, 50),
        service: 'LazyProof Digital Sponsored Profile Placement'
      }
    });

    if (!session?.session_id) {
      throw new Error('Dodo checkout session creation did not return a session_id.');
    }

    this.orderSessions.set(params.orderId, session.session_id);
    if (session.payment_id) {
      this.orderPayments.set(params.orderId, session.payment_id);
    }

    return {
      orderId: params.orderId,
      providerOrderId: session.session_id,
      paymentSessionId: session.session_id,
      checkoutUrl: session.checkout_url || undefined,
      idempotencyKey,
      currency: 'INR',
      amount: params.amount,
      status: 'ACTIVE'
    };
  }

  /**
   * Authoritative Payment Status Retrieval
   * Queries payment details from Dodo Payments and maps to system state
   */
  public async getPaymentStatus(orderId: string): Promise<ProviderPaymentStatus> {
    if (!this.isConfigured() || !this.client) {
      throw new Error('Dodo Payments credentials are not configured.');
    }

    // Attempt to recover payment ID or session ID from memory or database
    let paymentId = this.orderPayments.get(orderId);
    let sessionId = this.orderSessions.get(orderId);

    if (!paymentId || !sessionId) {
      try {
        const order = await db.getOrderAsync(orderId);
        if (order) {
          if (!sessionId && order.providerOrderId) {
            sessionId = order.providerOrderId;
            this.orderSessions.set(orderId, sessionId);
          }
          if (!paymentId && (order.paymentRef || (order as any).cf_payment_id)) {
            paymentId = order.paymentRef || (order as any).cf_payment_id;
            this.orderPayments.set(orderId, paymentId);
          }
        }
      } catch (err: any) {
        console.warn('[Dodo] Database lookup warning for order %s: %s', sanitizeLog(orderId), sanitizeLog(err?.message || err));
      }
    }

    // 1. If payment ID is known, query payment directly
    if (paymentId) {
      try {
        const payment = await this.client.payments.retrieve(paymentId);
        return this.mapPaymentToStatus(orderId, payment);
      } catch (err: any) {
        console.warn('[Dodo] Direct payment retrieve failed for %s: %s', sanitizeLog(paymentId), sanitizeLog(err?.message || err));
      }
    }

    // 2. If session ID is known, inspect checkout session
    if (sessionId) {
      try {
        const session = await this.client.checkoutSessions.retrieve(sessionId);
        if (session.payment_id) {
          this.orderPayments.set(orderId, session.payment_id);
          const payment = await this.client.payments.retrieve(session.payment_id);
          return this.mapPaymentToStatus(orderId, payment);
        }

        const rawStatus = (session.payment_status || '').toLowerCase();
        if (rawStatus === 'succeeded') {
          return { orderId, status: 'PAID' };
        } else if (rawStatus === 'failed') {
          return { orderId, status: 'FAILED' };
        } else if (rawStatus === 'cancelled') {
          return { orderId, status: 'CANCELLED' };
        }
      } catch (err: any) {
        console.warn('[Dodo] Checkout session retrieve failed for %s: %s', sanitizeLog(sessionId), sanitizeLog(err?.message || err));
      }
    }

    return { orderId, status: 'PENDING' };
  }

  private mapPaymentToStatus(orderId: string, payment: any): ProviderPaymentStatus {
    const rawStatus = (payment.status || '').toLowerCase();
    const currency = (payment.currency || 'INR').toUpperCase();
    const totalAmountPaise = typeof payment.total_amount === 'number' ? payment.total_amount : 0;
    const amountINR = totalAmountPaise / 100;
    const providerPaymentId = payment.payment_id || undefined;
    const paymentMethod = payment.payment_method || payment.payment_method_type || 'card';

    if (rawStatus === 'succeeded') {
      return {
        orderId,
        status: 'PAID',
        providerPaymentId,
        amount: amountINR,
        currency,
        paymentMethod,
        raw: payment
      };
    } else if (rawStatus === 'failed') {
      return { orderId, status: 'FAILED', providerPaymentId, raw: payment };
    } else if (rawStatus === 'cancelled') {
      return { orderId, status: 'CANCELLED', providerPaymentId, raw: payment };
    } else {
      return { orderId, status: 'PENDING', providerPaymentId, raw: payment };
    }
  }

  /**
   * Cryptographic Webhook Verification using StandardWebhooks
   * Required headers: webhook-id, webhook-timestamp, webhook-signature
   */
  public async verifyWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>
  ): Promise<WebhookVerificationResult> {
    const getHeader = (name: string): string | undefined => {
      const val = headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
      return Array.isArray(val) ? val[0] : val;
    };

    const webhookId = getHeader('webhook-id');
    const webhookTimestamp = getHeader('webhook-timestamp');
    const webhookSignature = getHeader('webhook-signature');

    if (!webhookId || !webhookTimestamp || !webhookSignature) {
      return {
        isValid: false,
        error: 'Missing authoritative Dodo webhook headers: webhook-id, webhook-timestamp, or webhook-signature.'
      };
    }

    if (!this.webhookKey) {
      return { isValid: false, error: 'DODO_PAYMENTS_WEBHOOK_KEY is not configured on server.' };
    }

    try {
      const verifier = this.webhookVerifier || new Webhook(this.webhookKey);
      verifier.verify(rawBody, {
        'webhook-id': webhookId.trim(),
        'webhook-timestamp': webhookTimestamp.trim(),
        'webhook-signature': webhookSignature.trim()
      });
    } catch (verifyErr: any) {
      return {
        isValid: false,
        error: `Cryptographic StandardWebhooks signature verification failed: ${verifyErr?.message || 'signature mismatch'}`
      };
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseErr: any) {
      return { isValid: false, error: 'Malformed JSON webhook payload.' };
    }

    const eventType = payload.type || payload.event;
    const data = payload.data || {};
    const metadata = data.metadata || {};
    const orderId = metadata.order_id || undefined;
    const providerPaymentId = data.payment_id ? String(data.payment_id) : undefined;
    const currency = typeof data.currency === 'string' ? data.currency.toUpperCase() : 'INR';
    const totalAmount = typeof data.total_amount === 'number' ? data.total_amount / 100 : (typeof data.amount === 'number' ? data.amount / 100 : undefined);
    const paymentMethod = data.payment_method || data.payment_method_type || 'card';

    // Handle refund events
    if (eventType === 'refund.succeeded' || eventType === 'refund.failed') {
      const refundId = metadata.merchant_refund_id || data.refund_id || '';
      const providerRefundId = data.refund_id ? String(data.refund_id) : undefined;
      const refundAmount = typeof data.amount === 'number' ? data.amount / 100 : 0;
      const refundStatus: 'SUCCESS' | 'FAILED' | 'PENDING' = eventType === 'refund.succeeded' ? 'SUCCESS' : 'FAILED';

      const parsedRefund: RefundWebhookDetails = {
        refundId,
        providerRefundId,
        orderId: orderId || '',
        amount: refundAmount,
        currency,
        status: refundStatus
      };

      return {
        isValid: true,
        event: eventType,
        orderId,
        providerPaymentId,
        amount: refundAmount,
        currency,
        status: refundStatus === 'SUCCESS' ? 'REFUNDED' : 'FAILED',
        refund: parsedRefund,
        rawPayload: payload
      };
    }

    // Handle payment events: payment.succeeded, payment.failed, payment.processing, payment.cancelled
    if (eventType === 'payment.succeeded') {
      return {
        isValid: true,
        event: eventType,
        orderId,
        providerPaymentId,
        amount: totalAmount,
        currency,
        paymentMethod,
        status: 'SUCCESS',
        rawPayload: payload
      };
    }

    if (eventType === 'payment.failed') {
      return {
        isValid: true,
        event: eventType,
        orderId,
        providerPaymentId,
        amount: totalAmount,
        currency,
        status: 'FAILED',
        rawPayload: payload
      };
    }

    if (eventType === 'payment.cancelled') {
      return {
        isValid: true,
        event: eventType,
        orderId,
        providerPaymentId,
        status: 'USER_DROPPED',
        rawPayload: payload
      };
    }

    if (eventType === 'payment.processing') {
      return {
        isValid: true,
        event: eventType,
        orderId,
        providerPaymentId,
        amount: totalAmount,
        currency,
        rawPayload: payload
      };
    }

    // Default return for other unhandled events
    return {
      isValid: true,
      event: eventType,
      orderId,
      providerPaymentId,
      rawPayload: payload
    };
  }

  /**
   * Initiate a refund with Dodo Payments
   */
  public async createRefund(params: RefundRequestParams): Promise<RefundResult> {
    if (!this.isConfigured() || !this.client) {
      throw new Error('Dodo Payments credentials are not configured.');
    }

    // Look up original provider payment ID from database or memory
    let paymentId = this.orderPayments.get(params.orderId);
    if (!paymentId) {
      const order = await db.getOrderAsync(params.orderId);
      paymentId = order?.paymentRef || (order as any)?.cf_payment_id;
    }

    if (!paymentId) {
      throw new Error(`Cannot initiate refund: No provider payment ID found for order ${params.orderId}.`);
    }

    try {
      const refund = await this.client.refunds.create({
        payment_id: paymentId,
        reason: params.reason,
        metadata: {
          merchant_refund_id: params.refundId,
          order_id: params.orderId
        }
      });

      const rawStatus = (refund.status || '').toLowerCase();
      let status: 'SUCCESS' | 'FAILED' | 'PENDING' = 'PENDING';
      if (rawStatus === 'succeeded') {
        status = 'SUCCESS';
      } else if (rawStatus === 'failed') {
        status = 'FAILED';
      }

      return {
        success: status !== 'FAILED',
        refundId: params.refundId,
        status,
        raw: refund
      };
    } catch (err: any) {
      console.error('[Dodo] createRefund failed for %s: %s', sanitizeLog(params.orderId), sanitizeLog(err?.message || err));
      return {
        success: false,
        refundId: params.refundId,
        status: 'FAILED',
        error: err?.message || 'Dodo Payments refund creation failed.'
      };
    }
  }

  /**
   * Query status of an existing refund
   */
  public async getRefundStatus(orderId: string, merchantRefundId: string): Promise<ProviderRefundStatus> {
    if (!this.isConfigured() || !this.client) {
      throw new Error('Dodo Payments credentials are not configured.');
    }

    // Look up provider_refund_id from refund_reversals if available
    let providerRefundId = '';
    try {
      if (db.isPostgresAuthoritative()) {
        const res = await (db.pg as any).getPool().then((pool: any) =>
          pool.query('SELECT provider_refund_id, amount, currency FROM refund_reversals WHERE id = $1 LIMIT 1', [merchantRefundId])
        );
        if (res.rows.length > 0 && res.rows[0].provider_refund_id) {
          providerRefundId = res.rows[0].provider_refund_id;
        }
      }
    } catch {}

    const targetRefundId = providerRefundId || merchantRefundId;
    if (targetRefundId) {
      try {
        const refund = await this.client.refunds.retrieve(targetRefundId);
        const rawStatus = (refund.status || '').toLowerCase();
        let status: 'PENDING' | 'SUCCESS' | 'FAILED' = 'PENDING';
        if (rawStatus === 'succeeded') {
          status = 'SUCCESS';
        } else if (rawStatus === 'failed') {
          status = 'FAILED';
        }

        return {
          orderId,
          merchantRefundId,
          providerRefundId: refund.refund_id || targetRefundId,
          status,
          amount: typeof refund.amount === 'number' ? refund.amount / 100 : 0,
          currency: (refund.currency || 'INR').toUpperCase(),
          raw: refund
        };
      } catch (err: any) {
        console.warn('[Dodo] getRefundStatus retrieve failed for %s: %s', sanitizeLog(targetRefundId), sanitizeLog(err?.message || err));
      }
    }

    return {
      orderId,
      merchantRefundId,
      providerRefundId: providerRefundId || merchantRefundId,
      status: 'PENDING',
      amount: 0,
      currency: 'INR'
    };
  }
}

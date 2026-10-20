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
  ProviderRefundStatus,
  toSafePaise
} from './provider.ts';
import { db } from '../db.ts';
import { MIN_INR_PAISE, MIN_USD_CENTS, validatePaymentAmount } from './pricingPolicy.ts';

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

  // In-memory cache for fixed-price products: cacheKey (currency:amountMinor) -> productId
  private productCache: Map<string, string> = new Map();
  // Mutex to protect concurrent creation of products for the same amount
  private inFlightCreations: Map<string, Promise<string>> = new Map();
  // Order to session and payment lookup cache
  private orderSessions: Map<string, string> = new Map();
  private orderPayments: Map<string, string> = new Map();

  constructor(options?: DodoProviderOptions) {
    this.apiKey = (options?.apiKey || process.env.DODO_PAYMENTS_API_KEY || '').trim();
    this.webhookKey = (options?.webhookKey || process.env.DODO_PAYMENTS_WEBHOOK_KEY || '').trim();
    this.configuredProductId = (options?.productId || process.env.DODO_PRODUCT_ID || '').trim() || undefined;

    // Strict environment resolution with explicit options precedence
    if (options?.environment) {
      this.environment = options.environment;
    } else {
      const rawEnv = (process.env.DODO_PAYMENTS_ENVIRONMENT || '').toLowerCase().trim();
      if (rawEnv === 'live_mode') {
        this.environment = 'live_mode';
      } else if (rawEnv === 'test_mode') {
        this.environment = 'test_mode';
      } else {
        this.environment = (options?.isTestMode ?? (process.env.PAYMENT_MODE === 'sandbox')) ? 'test_mode' : 'live_mode';
      }
    }

    // Fail-closed security guard: PAYMENT_MODE=live strictly rejects test_mode
    if (process.env.PAYMENT_MODE === 'live' && this.environment === 'test_mode') {
      console.warn(
        '[Dodo] SECURITY WARNING: Conflicting configuration detected (PAYMENT_MODE=live but environment=test_mode). Disabling client initialization.'
      );
      this.apiKey = '';
      this.webhookKey = '';
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
    return Boolean(this.apiKey && this.webhookKey && this.client && this.webhookVerifier);
  }

  public getEnvironment(): 'test_mode' | 'live_mode' {
    return this.environment;
  }

  public getClient(): DodoPayments | undefined {
    return this.client;
  }

  /**
   * Resolve or safely create an immutable fixed-price product for the required currency and amount.
   * Strategy: Immutable fixed-price products with quantity = 1.
   * Namespaced by provider, environment, account, currency, amount_minor, and pricing version.
   * Never mutates a shared product's price for another order.
   */
  public async resolveProductForAmount(amountMajor: number, currency: string = 'INR'): Promise<string> {
    const cleanCurrency = currency.toUpperCase().trim();
    const isUSD = cleanCurrency === 'USD';
    const amountMinor = Math.round(amountMajor * 100);

    // Enforce business minimums before querying or creating remote products
    if (cleanCurrency === 'INR') {
      if (!Number.isInteger(amountMajor)) {
        throw new Error('Dodo Payments requires whole integer INR amounts.');
      }
      if (amountMinor < MIN_INR_PAISE) {
        throw new Error(`Minimum sponsorship is ₹99. Enter ₹99 or more to continue.`);
      }
    } else if (cleanCurrency === 'USD') {
      if (amountMinor < MIN_USD_CENTS) {
        throw new Error(`Minimum sponsorship is $5.00. Enter $5.00 or more to continue.`);
      }
    }

    // Configured product override: only use if amount matches, never accept a fixed INR 99 product for an INR 100 order!
    if (this.configuredProductId) {
      // In testing/config with explicit single product, only honor if amount matches ₹99 or configured base
      if (cleanCurrency === 'INR' && amountMinor === MIN_INR_PAISE) {
        return this.configuredProductId;
      }
    }

    const cacheKey = `${cleanCurrency}:${amountMinor}`;

    // 1. Check L1 in-memory cache
    const cached = this.productCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. Check L2 durable database (cross-process, restart, and replica safe)
    try {
      const res = await db.getPaymentProductAsync(
        'dodo',
        cleanCurrency,
        amountMinor,
        this.environment,
        'primary',
        'v1'
      );
      const durableProductId = res && typeof res === 'object' ? ((res as any).productId || (res as any).providerProductId) : (res ? String(res) : null);
      if (durableProductId) {
        this.productCache.set(cacheKey, durableProductId);
        return durableProductId;
      }
    } catch (dbErr: any) {
      console.warn('[Dodo] Durable product lookup warning:', sanitizeLog(dbErr?.message || dbErr));
    }

    // 3. Coordinate within this process to avoid duplicate concurrent API calls
    const inFlight = this.inFlightCreations.get(cacheKey);
    if (inFlight !== undefined) {
      return await inFlight;
    }

    if (!this.client) {
      throw new Error('Dodo Payments client is not initialized.');
    }

    const creationPromise = (async () => {
      // Re-check durable storage in case another worker created it concurrently
      try {
        const checkRes = await db.getPaymentProductAsync(
          'dodo',
          cleanCurrency,
          amountMinor,
          this.environment,
          'primary',
          'v1'
        );
        const doubleCheck = checkRes && typeof checkRes === 'object' ? ((checkRes as any).productId || (checkRes as any).providerProductId) : (checkRes ? String(checkRes) : null);
        if (doubleCheck) {
          this.productCache.set(cacheKey, doubleCheck);
          return doubleCheck;
        }
      } catch {}

      const productDeterministicId = `prod_dodo_${cleanCurrency.toLowerCase()}_${amountMinor}_${this.environment}`;

      try {
        const productName = isUSD
          ? `LazyProof Verified Placement - $${amountMajor.toFixed(2)}`
          : `LazyProof Verified Placement - ₹${amountMajor}`;

        const productDesc = isUSD
          ? `Verified public leaderboard digital placement on LazyProof (operated by ADABHRA GROUP). Amount: $${amountMajor.toFixed(2)} USD`
          : `Verified public leaderboard digital placement on LazyProof (operated by ADABHRA GROUP). Amount: ₹${amountMajor} INR`;

        const product = await this.client!.products.create(
          {
            name: productName,
            description: productDesc,
            tax_category: 'digital_products',
            price: {
              type: 'one_time_price',
              currency: cleanCurrency as any,
              price: amountMinor,
              tax_inclusive: true
            }
          },
          {
            idempotencyKey: productDeterministicId,
            headers: { 'Idempotency-Key': productDeterministicId }
          }
        );

        if (!product?.product_id) {
          throw new Error('Dodo product creation did not return a product_id.');
        }

        // Durably save product mapping for multi-replica and restart coordination
        let finalProductId = product.product_id;
        try {
          finalProductId = await db.savePaymentProductAsync(
            'dodo',
            cleanCurrency,
            amountMinor,
            product.product_id,
            this.environment,
            'primary',
            'v1'
          );
        } catch (saveErr: any) {
          console.warn('[Dodo] Failed to save product to durable storage:', sanitizeLog(saveErr?.message || saveErr));
        }

        this.productCache.set(cacheKey, finalProductId);
        return finalProductId;
      } catch (err: any) {
        // Handle ambiguous API timeout or network retry by checking if product was recorded
        try {
          const recRes = await db.getPaymentProductAsync(
            'dodo',
            cleanCurrency,
            amountMinor,
            this.environment,
            'primary',
            'v1'
          );
          const recovered = recRes && typeof recRes === 'object' ? ((recRes as any).productId || (recRes as any).providerProductId) : (recRes ? String(recRes) : null);
          if (recovered) {
            this.productCache.set(cacheKey, recovered);
            return recovered;
          }
        } catch {}

        console.error('[Dodo] Failed to create fixed-price product for %d minor units: %s', amountMinor, sanitizeLog(err?.message || err));
        const errMsg = String(err?.message || err);
        if (errMsg.includes('0.50') || errMsg.toLowerCase().includes('minimum') || errMsg.toLowerCase().includes('equivalent')) {
          throw new Error(
            isUSD
              ? `Dodo Payments minimum payment requirement not met: amount $${amountMajor} must be at least $5.00.`
              : `Dodo Payments minimum payment requirement not met: amount ₹${amountMajor} must be at least ₹99 ($0.50 USD equivalent).`
          );
        }
        throw new Error(err?.message || `Failed to create fixed-price product for ${amountMajor} ${cleanCurrency}`);
      }
    })();

    this.inFlightCreations.set(cacheKey, creationPromise);
    try {
      return await creationPromise;
    } finally {
      this.inFlightCreations.delete(cacheKey);
    }
  }

  /**
   * Create Checkout Session for the order with exact pricing and atomic tracking
   */
  public async createOrder(params: CreateOrderParams): Promise<ProviderOrderResult> {
    if (!this.isConfigured()) {
      throw new Error('Dodo Payments credentials are not configured.');
    }

    if (!this.client) {
      throw new Error('Dodo Payments client is not available.');
    }

    const currency = (params.currency || 'INR').toUpperCase().trim();
    const amountMinor = Math.round(params.amount * 100);

    // Validate payment amount using authoritative business pricing policy (params.amount in major units)
    const validation = validatePaymentAmount(params.amount, currency);
    if (!validation.isValid) {
      throw new Error(validation.errorMessage || 'Invalid payment amount.');
    }

    if (currency === 'USD') {
      const rawUsdEnabled = (process.env.DODO_USD_ENABLED || 'false').toLowerCase().trim();
      if (rawUsdEnabled !== 'true') {
        throw new Error('CURRENCY_NOT_AVAILABLE: USD payments are currently disabled.');
      }
    }

    if (currency === 'INR' && params.amount > 1000000) {
      throw new Error('Payment amount exceeds maximum limit of ₹10,00,000.');
    }

    const productId = await this.resolveProductForAmount(params.amount, currency);
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

    try {
      const session = await this.client.checkoutSessions.create(
        {
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
            currency,
            service: 'LazyProof Digital Sponsored Profile Placement'
          }
        },
        {
          idempotencyKey,
          headers: { 'Idempotency-Key': idempotencyKey }
        }
      );

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
        currency,
        amount: params.amount,
        status: 'ACTIVE'
      };
    } catch (err: any) {
      console.error('[Dodo] checkoutSession creation failed for %s: %s', sanitizeLog(params.orderId), sanitizeLog(err?.message || err));
      const errMsg = String(err?.message || err);
      if (errMsg.includes('0.50') || errMsg.toLowerCase().includes('minimum') || errMsg.toLowerCase().includes('equivalent')) {
        throw new Error(
          currency === 'USD'
            ? `Dodo Payments minimum payment requirement not met: amount $${params.amount} must be at least $5.00.`
            : `Dodo Payments minimum payment requirement not met: amount ₹${params.amount} must be at least ₹99.`
        );
      }
      throw err;
    }
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
        // A checkout session claiming succeeded without an actual retrieved payment ID/amount/currency is NOT enough to settle
        if (rawStatus === 'failed') {
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
    const rawStatus = (payment?.status || '').toLowerCase();
    const currency = payment?.currency ? String(payment.currency).toUpperCase().trim() : undefined;
    const totalAmountMinor = typeof payment?.total_amount === 'number' ? payment.total_amount : undefined;
    const providerPaymentId = payment?.payment_id || undefined;
    const paymentMethod = payment?.payment_method || payment?.payment_method_type || 'card';

    // Verify order ID association if payment metadata exists
    const metaOrderId = payment?.metadata?.order_id || payment?.metadata?.orderId;
    if (metaOrderId && metaOrderId !== orderId) {
      console.warn(`[Dodo] Order ID mismatch: expected ${sanitizeLog(orderId)}, payment metadata has ${sanitizeLog(metaOrderId)}`);
      return {
        orderId,
        status: 'FAILED',
        providerPaymentId,
        raw: payment
      };
    }

    // Disallow settling as PAID if currency or amount or payment ID is missing
    if (rawStatus === 'succeeded') {
      if (!currency || totalAmountMinor === undefined || totalAmountMinor <= 0 || !providerPaymentId) {
        console.warn('[Dodo] Succeeded payment missing authoritative currency, amount, or paymentId:', sanitizeLog(payment));
        return {
          orderId,
          status: 'FAILED',
          providerPaymentId,
          raw: payment
        };
      }

      return {
        orderId,
        status: 'PAID',
        providerPaymentId,
        amount: totalAmountMinor / 100,
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
    const rawCurrency = typeof data.currency === 'string' ? data.currency.toUpperCase() : undefined;
    const totalAmount = typeof data.total_amount === 'number'
      ? data.total_amount / 100
      : (typeof data.amount === 'number' ? data.amount / 100 : undefined);
    const paymentMethod = data.payment_method || data.payment_method_type || 'card';

    // Handle refund events
    if (eventType === 'refund.succeeded' || eventType === 'refund.failed') {
      const refundId = data.refund_id ? String(data.refund_id) : '';
      const merchantRefundId = metadata.merchant_refund_id || refundId;
      const refundAmount = typeof data.amount === 'number' ? data.amount / 100 : 0;
      const isSuccess = eventType === 'refund.succeeded';

      return {
        isValid: true,
        event: eventType,
        orderId,
        providerPaymentId,
        amount: refundAmount,
        currency: rawCurrency,
        status: isSuccess ? 'REFUNDED' : 'FAILED',
        refund: {
          refundId: merchantRefundId,
          providerRefundId: refundId,
          orderId: orderId || '',
          amount: refundAmount,
          currency: rawCurrency || 'INR',
          status: isSuccess ? 'SUCCESS' : 'FAILED'
        },
        rawPayload: payload
      };
    }

    const isPaid = eventType === 'payment.succeeded' || eventType === 'payment.successful';
    const isFailed = eventType === 'payment.failed';

    return {
      isValid: true,
      event: eventType,
      orderId,
      providerPaymentId,
      amount: totalAmount,
      currency: rawCurrency,
      paymentMethod,
      status: isPaid ? 'SUCCESS' : isFailed ? 'FAILED' : undefined,
      rawPayload: payload
    };
  }

  /**
   * Initiate a refund with Dodo Payments with line items for partial refunds
   */
  public async createRefund(params: RefundRequestParams): Promise<RefundResult> {
    if (!this.isConfigured() || !this.client) {
      throw new Error('Dodo Payments credentials are not configured.');
    }

    // Look up original provider payment ID and order details
    let paymentId = this.orderPayments.get(params.orderId);
    let order: any = null;
    if (!paymentId) {
      order = await db.getOrderAsync(params.orderId);
      paymentId = order?.paymentRef || (order as any)?.cf_payment_id;
    } else {
      order = await db.getOrderAsync(params.orderId);
    }

    if (!paymentId) {
      throw new Error(`Cannot initiate refund: No provider payment ID found for order ${params.orderId}.`);
    }

    let orderAmount = Number(order?.amount || 0);
    let orderPaise = Math.round(orderAmount * 100);
    const refundPaise = Math.round(params.amount * 100);

    let paymentDetails: any;
    if (orderPaise === 0) {
      try {
        paymentDetails = await this.client.payments.retrieve(paymentId);
        if (paymentDetails?.total_amount) {
          orderPaise = Number(paymentDetails.total_amount);
          orderAmount = orderPaise / 100;
        }
      } catch {}
    }

    const isPartial = refundPaise > 0 && refundPaise < orderPaise;

    // Retrieve order's line item product ID for partial refund
    let lineItemId: string | undefined;
    if (isPartial) {
      try {
        if (typeof (this.client?.payments as any)?.retrieveLineItems === 'function') {
          const lineItemsRes = await (this.client!.payments as any).retrieveLineItems(paymentId);
          const items = Array.isArray(lineItemsRes) ? lineItemsRes : (lineItemsRes as any)?.items || [];
          if (items.length > 0) {
            lineItemId = items[0].product_id || items[0].item_id || items[0].id;
          }
        }
        if (!lineItemId) {
          const payment = paymentDetails || await this.client.payments.retrieve(paymentId);
          if (payment && Array.isArray((payment as any).items) && (payment as any).items.length > 0) {
            lineItemId = (payment as any).items[0].product_id || (payment as any).items[0].item_id || (payment as any).items[0].id;
          }
        }
      } catch (pErr) {
        console.warn('[Dodo] Could not retrieve payment items for partial refund:', sanitizeLog(pErr));
      }

      // Mandatory contract check: never guess product or create new product during refund!
      if (!lineItemId) {
        throw new Error(`Cannot initiate partial refund for order ${params.orderId}: original payment line items cannot be verified.`);
      }
    }

    try {
      const refundBody: any = {
        payment_id: paymentId,
        reason: params.reason,
        metadata: {
          merchant_refund_id: params.refundId,
          order_id: params.orderId
        }
      };

    const orderCurrency = (order?.chargeCurrency || order?.currency || paymentDetails?.currency || 'INR').toUpperCase();

    if (isPartial) {
      // Directive Item 4: Dodo Payments item-level partial-refund amount is documented in USD cents.
      // For INR purchases, converting INR paise to USD cents or sending paise as USD cents is unsafe.
      // If exact INR partial refund semantics cannot be demonstrated without currency unit discrepancy,
      // automated INR partial refund initiation is disabled and requires operator handling.
      if (orderCurrency === 'INR') {
        throw new Error(`AUTOMATED_INR_PARTIAL_REFUND_REQUIRES_OPERATOR_REVIEW: Dodo Payments item-level partial refund amount requires USD cents. Automated partial refunds for INR orders are disabled to prevent currency unit discrepancy. Operator review required for order ${params.orderId}.`);
      }
      if (!lineItemId) {
        throw new Error('Partial refund requires verified line item ID.');
      }
      refundBody.items = [
        {
          item_id: lineItemId,
          amount: Math.round(params.amount * 100), // In USD cents for USD currency
          tax_inclusive: true
        }
      ];
    }

      const refund = await this.client.refunds.create(
        refundBody,
        {
          idempotencyKey: params.refundId,
          headers: { 'Idempotency-Key': params.refundId }
        }
      );

      const rawStatus = (refund.status || '').toLowerCase();
      let status: 'SUCCESS' | 'FAILED' | 'PENDING' = 'PENDING';
      if (rawStatus === 'succeeded') {
        status = 'SUCCESS';
      } else if (rawStatus === 'failed') {
        status = 'FAILED';
      }

      // Bind provider_refund_id immediately on acknowledgement
      if (refund.refund_id) {
        if (db.isPostgresAuthoritative()) {
          await db.pg.bindRefundProviderId(params.orderId, params.refundId, refund.refund_id);
        }
      }

      return {
        success: status !== 'FAILED',
        refundId: params.refundId,
        providerRefundId: refund.refund_id,
        status,
        raw: refund
      };
    } catch (err: any) {
      console.error('[Dodo] createRefund failed for %s: %s', sanitizeLog(params.orderId), sanitizeLog(err?.message || err));
      const msg = String(err?.message || err).toLowerCase();
      const isDefinitiveFailure = msg.includes('unrefundable') || msg.includes('not refundable') || msg.includes('already refunded');

      return {
        success: false,
        refundId: params.refundId,
        status: isDefinitiveFailure ? 'FAILED' : 'UNKNOWN',
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

    let providerRefundId = '';
    try {
      if (db.isPostgresAuthoritative()) {
        const pool = await (db.pg as any).getPool();
        const res = await pool.query(
          'SELECT provider_refund_id, amount, currency FROM refund_reversals WHERE (id = $1 OR merchant_refund_id = $1) AND order_id = $2 LIMIT 1',
          [merchantRefundId, orderId]
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

        if (refund.refund_id && !providerRefundId && db.isPostgresAuthoritative()) {
          await db.pg.bindRefundProviderId(orderId, merchantRefundId, refund.refund_id);
        }

        return {
          orderId,
          merchantRefundId,
          providerRefundId: refund.refund_id || targetRefundId,
          status,
          amount: typeof refund.amount === 'number' ? refund.amount / 100 : 0,
          currency: (refund.currency ? String(refund.currency).toUpperCase() : 'INR'),
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

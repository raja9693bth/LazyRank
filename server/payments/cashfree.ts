import crypto from 'crypto';
import { PaymentProvider, CreateOrderParams, ProviderOrderResult, ProviderPaymentStatus, WebhookVerificationResult, RefundRequestParams, RefundResult, RefundWebhookDetails, ProviderRefundStatus } from './provider.ts';

export const DEFAULT_CASHFREE_API_VERSION = '2026-01-01';

export class CashfreeProvider implements PaymentProvider {
  public name = 'cashfree';
  private appId: string;
  private secretKey: string;
  private apiVersion: string;
  private isSandbox: boolean;
  private baseUrl: string;

  constructor(options?: {
    appId?: string;
    secretKey?: string;
    apiVersion?: string;
    isSandbox?: boolean;
  }) {
    this.appId = (options?.appId || process.env.CASHFREE_APP_ID || '').trim();
    // Cashfree official webhook verification uses the Cashfree PG secret key
    this.secretKey = (options?.secretKey || process.env.CASHFREE_SECRET_KEY || '').trim();
    this.apiVersion = (options?.apiVersion || process.env.CASHFREE_API_VERSION || DEFAULT_CASHFREE_API_VERSION).trim();
    this.isSandbox = options?.isSandbox ?? (process.env.PAYMENT_MODE === 'sandbox');
    this.baseUrl = this.isSandbox
      ? 'https://sandbox.cashfree.com/pg'
      : 'https://api.cashfree.com/pg';
  }

  public isConfigured(): boolean {
    return this.appId.length > 0 && this.secretKey.length > 0;
  }

  public getApiVersion(): string {
    return this.apiVersion;
  }

  /**
   * Cashfree PG Order Creation with Idempotency Support
   * Endpoint: POST /pg/orders
   * Headers: x-client-id, x-client-secret, x-api-version, x-idempotency-key
   */
  public async createOrder(params: CreateOrderParams): Promise<ProviderOrderResult> {
    if (!this.isConfigured()) {
      throw new Error('Cashfree credentials are not configured.');
    }

    const customerId = 'cust_' + crypto.createHash('sha256').update(`${params.customerPhone || '9876543210'}:${params.orderId}`).digest('hex').slice(0, 16);
    const returnUrl = params.returnUrl || `https://lazyproof.online/?order_id=${params.orderId}&status=return`;
    const notifyUrl = params.notifyUrl || `https://lazyproof.online/api/payment/webhook`;
    const idempotencyKey = params.idempotencyKey || crypto.randomUUID();

    const customerPhone = (params.customerPhone && params.customerPhone.trim()) || '9876543210';
    const customerDetails: Record<string, string> = {
      customer_id: customerId,
      customer_name: params.customerName.slice(0, 50),
      customer_phone: customerPhone
    };
    if (params.customerEmail && params.customerEmail.trim()) {
      customerDetails.customer_email = params.customerEmail.trim();
    }

    const payload = {
      order_id: params.orderId,
      order_amount: params.amount,
      order_currency: params.currency || 'INR',
      customer_details: customerDetails,
      order_meta: {
        return_url: returnUrl,
        notify_url: notifyUrl
      },
      order_note: params.note || 'Digital sponsored profile placement on LazyProof'
    };

    const res = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'x-client-id': this.appId,
        'x-client-secret': this.secretKey,
        'x-api-version': this.apiVersion,
        'x-idempotency-key': idempotencyKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data: any = await res.json();

    if (!res.ok) {
      console.error('[Cashfree] Order creation failed:', data);
      throw new Error(data.message || `Cashfree order creation returned status ${res.status}`);
    }

    return {
      orderId: params.orderId,
      providerOrderId: data.cf_order_id ? String(data.cf_order_id) : undefined,
      paymentSessionId: data.payment_session_id,
      checkoutUrl: data.payments?.url || undefined,
      idempotencyKey,
      amount: data.order_amount,
      currency: data.order_currency,
      status: data.order_status === 'PAID' ? 'PAID' : 'ACTIVE'
    };
  }

  /**
   * Cashfree PG Payment Status
   * Queries /orders/{orderId}/payments to inspect all settlement attempts.
   */
  public async getPaymentStatus(orderId: string): Promise<ProviderPaymentStatus> {
    if (!this.isConfigured()) {
      throw new Error('Cashfree credentials are not configured.');
    }

    const res = await fetch(`${this.baseUrl}/orders/${encodeURIComponent(orderId)}/payments`, {
      method: 'GET',
      headers: {
        'x-client-id': this.appId,
        'x-client-secret': this.secretKey,
        'x-api-version': this.apiVersion
      }
    });

    if (!res.ok) {
      return { orderId, status: 'PENDING' };
    }

    const payments: any = await res.json();
    if (!Array.isArray(payments) || payments.length === 0) {
      return { orderId, status: 'PENDING' };
    }

    // Find successful payment
    const successful = payments.find((p: any) => p.payment_status === 'SUCCESS');
    if (successful) {
      if (!successful.payment_currency) {
        throw new Error('Cashfree payment record missing payment_currency.');
      }
      return {
        orderId,
        status: 'PAID',
        providerPaymentId: String(successful.cf_payment_id),
        amount: Number(successful.payment_amount),
        currency: successful.payment_currency,
        paymentMethod: successful.payment_group || 'UPI',
        raw: successful
      };
    }

    const failed = payments.find((p: any) => p.payment_status === 'FAILED');
    if (failed) {
      return { orderId, status: 'FAILED', raw: failed };
    }

    const userDropped = payments.find((p: any) => p.payment_status === 'USER_DROPPED');
    if (userDropped) {
      return { orderId, status: 'USER_DROPPED', raw: userDropped };
    }

    const cancelled = payments.find((p: any) => p.payment_status === 'CANCELLED');
    if (cancelled) {
      return { orderId, status: 'CANCELLED', raw: cancelled };
    }

    return { orderId, status: 'PENDING' };
  }

  /**
   * Cashfree PG Webhook Verification
   * Official Cashfree Verification Algorithm:
   * Algorithm: Base64(HMAC-SHA256(timestamp + rawBody, CASHFREE_SECRET_KEY))
   */
  public async verifyWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>
  ): Promise<WebhookVerificationResult> {
    const rawTimestamp = headers['x-webhook-timestamp'] || headers['X-Webhook-Timestamp'];
    const rawSignature = headers['x-webhook-signature'] || headers['X-Webhook-Signature'];

    const timestamp = Array.isArray(rawTimestamp) ? rawTimestamp[0] : rawTimestamp;
    const signature = Array.isArray(rawSignature) ? rawSignature[0] : rawSignature;

    if (!signature || !timestamp) {
      return { isValid: false, error: 'Missing webhook signature or timestamp header.' };
    }

    if (!/^(?:\d{10}|\d{13})$/.test(timestamp)) {
      return { isValid: false, error: 'Invalid webhook timestamp format.' };
    }
    const tsNum = Number(timestamp);
    const tsMillis = timestamp.length === 10 ? tsNum * 1000 : tsNum;
    if (!Number.isFinite(tsNum) || !Number.isSafeInteger(tsNum) || Math.abs(Date.now() - tsMillis) > 300_000) {
      return { isValid: false, error: 'Webhook timestamp outside five-minute window.' };
    }

    if (!this.secretKey) {
      return { isValid: false, error: 'Cashfree secret key is not configured on server.' };
    }

    try {
      const signedPayload = timestamp + rawBody;
      const expectedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(signedPayload)
        .digest('base64');

      const sigBuf = Buffer.from(signature.trim());
      const expectedBuf = Buffer.from(expectedSignature.trim());

      if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        return { isValid: false, error: 'Cryptographic HMAC signature mismatch against CASHFREE_SECRET_KEY.' };
      }

      // Parse verified body
      const body = JSON.parse(rawBody);
      const eventType = body.type || body.event;

      // Handle dedicated Cashfree Refund Webhooks explicitly
      const refundData = body.data?.refund;
      if (refundData || eventType === 'REFUND_SUCCESS_WEBHOOK' || eventType === 'REFUND_FAILED_WEBHOOK') {
        const rawStatus = (refundData?.refund_status || (eventType === 'REFUND_SUCCESS_WEBHOOK' ? 'SUCCESS' : 'FAILED')).toUpperCase();
        const refundStatus: 'SUCCESS' | 'FAILED' | 'PENDING' =
          rawStatus === 'SUCCESS' ? 'SUCCESS' : rawStatus === 'PENDING' ? 'PENDING' : 'FAILED';

        const parsedRefund: RefundWebhookDetails = {
          refundId: refundData?.refund_id || body.refund_id || '',
          providerRefundId: refundData?.cf_refund_id ? String(refundData.cf_refund_id) : undefined,
          orderId: refundData?.order_id || body.data?.order?.order_id || body.orderId || '',
          amount: Number(refundData?.refund_amount || body.refund_amount || 0),
          currency: refundData?.refund_currency || body.data?.order?.order_currency || 'INR',
          status: refundStatus,
          arn: refundData?.refund_arn
        };

        return {
          isValid: true,
          event: eventType,
          orderId: parsedRefund.orderId,
          amount: parsedRefund.amount,
          currency: parsedRefund.currency,
          status: parsedRefund.status === 'SUCCESS' ? 'REFUNDED' : 'FAILED',
          refund: parsedRefund,
          rawPayload: body
        };
      }

      // Handle standard Payment Webhooks
      const order = body.data?.order || {};
      const payment = body.data?.payment || {};

      let status: 'SUCCESS' | 'FAILED' | 'USER_DROPPED' | 'REFUNDED' | undefined;
      if (eventType === 'PAYMENT_SUCCESS_WEBHOOK' && payment.payment_status === 'SUCCESS') {
        status = 'SUCCESS';
      } else if (eventType === 'PAYMENT_FAILED_WEBHOOK' && payment.payment_status === 'FAILED') {
        status = 'FAILED';
      } else if (eventType === 'PAYMENT_USER_DROPPED_WEBHOOK' && payment.payment_status === 'USER_DROPPED') {
        status = 'USER_DROPPED';
      } else {
        return { isValid: false, error: 'Inconsistent Cashfree event and payment status.' };
      }

      return {
        isValid: true,
        event: eventType,
        orderId: order.order_id || body.orderId,
        providerPaymentId: payment.cf_payment_id ? String(payment.cf_payment_id) : undefined,
        amount: payment.payment_amount ? Number(payment.payment_amount) : order.order_amount ? Number(order.order_amount) : undefined,
        currency: payment.payment_currency || order.order_currency || 'INR',
        status,
        rawPayload: body
      };
    } catch (err: any) {
      return { isValid: false, error: err?.message || 'Error parsing and verifying webhook payload.' };
    }
  }

  /**
   * Cashfree PG Refund Request
   * Endpoint: POST /pg/orders/{orderId}/refunds
   */
  public async createRefund(params: RefundRequestParams): Promise<RefundResult> {
    if (!this.isConfigured()) {
      throw new Error('Cashfree credentials are not configured.');
    }

    const payload = {
      refund_amount: params.amount,
      refund_id: params.refundId,
      refund_note: params.reason
    };

    const res = await fetch(`${this.baseUrl}/orders/${encodeURIComponent(params.orderId)}/refunds`, {
      method: 'POST',
      headers: {
        'x-client-id': this.appId,
        'x-client-secret': this.secretKey,
        'x-api-version': this.apiVersion,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data: any = await res.json();
    if (!res.ok) {
      return {
        success: false,
        refundId: params.refundId,
        status: 'FAILED',
        error: data.message || `Cashfree refund returned status ${res.status}`
      };
    }

    return {
      success: true,
      refundId: params.refundId,
      status: data.refund_status === 'SUCCESS' ? 'SUCCESS' : 'PENDING',
      raw: data
    };
  }

  /**
   * Cashfree PG Get Refund Status
   * Endpoint: GET /pg/orders/{orderId}/refunds/{merchantRefundId}
   */
  public async getRefundStatus(orderId: string, merchantRefundId: string): Promise<ProviderRefundStatus> {
    if (!this.isConfigured()) {
      throw new Error('Cashfree credentials are not configured.');
    }

    const res = await fetch(`${this.baseUrl}/orders/${encodeURIComponent(orderId)}/refunds/${encodeURIComponent(merchantRefundId)}`, {
      method: 'GET',
      headers: {
        'x-client-id': this.appId,
        'x-client-secret': this.secretKey,
        'x-api-version': this.apiVersion
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Cashfree getRefundStatus returned HTTP ${res.status}: ${errText}`);
    }

    const data: any = await res.json();
    const rawStatus = String(data.refund_status || '').toUpperCase();
    const status: 'PENDING' | 'SUCCESS' | 'FAILED' =
      rawStatus === 'SUCCESS' ? 'SUCCESS' : rawStatus === 'PENDING' ? 'PENDING' : 'FAILED';

    return {
      orderId: data.order_id || orderId,
      merchantRefundId: data.refund_id || merchantRefundId,
      providerRefundId: String(data.cf_refund_id || ''),
      status,
      amount: Number(data.refund_amount || 0),
      currency: 'INR',
      raw: data
    };
  }
}

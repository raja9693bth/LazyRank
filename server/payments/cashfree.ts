import crypto from 'crypto';
import { PaymentProvider, CreateOrderParams, ProviderOrderResult, ProviderPaymentStatus, WebhookVerificationResult, RefundRequestParams, RefundResult } from './provider.ts';
import { constantTimeMatch } from '../db.ts';

export class CashfreeProvider implements PaymentProvider {
  public name = 'cashfree';
  private appId: string;
  private secretKey: string;
  private webhookSecret: string;
  private isSandbox: boolean;
  private baseUrl: string;

  constructor(options?: {
    appId?: string;
    secretKey?: string;
    webhookSecret?: string;
    isSandbox?: boolean;
  }) {
    this.appId = (options?.appId || process.env.CASHFREE_APP_ID || '').trim();
    this.secretKey = (options?.secretKey || process.env.CASHFREE_SECRET_KEY || '').trim();
    this.webhookSecret = (options?.webhookSecret || process.env.PAYMENT_WEBHOOK_SECRET || this.secretKey).trim();
    this.isSandbox = options?.isSandbox ?? (process.env.PAYMENT_MODE === 'sandbox');
    this.baseUrl = this.isSandbox
      ? 'https://sandbox.cashfree.com/pg'
      : 'https://api.cashfree.com/pg';
  }

  public isConfigured(): boolean {
    return this.appId.length > 0 && this.secretKey.length > 0;
  }

  /**
   * Cashfree PG Order Creation (API Version 2023-08-01)
   */
  public async createOrder(params: CreateOrderParams): Promise<ProviderOrderResult> {
    if (!this.isConfigured()) {
      throw new Error('Cashfree credentials are not configured.');
    }

    const customerId = 'cust_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const returnUrl = params.returnUrl || `https://lazyproof.online/?order_id=${params.orderId}&status=return`;
    const notifyUrl = params.notifyUrl || `https://lazyproof.online/api/payment/webhook`;

    const payload = {
      order_id: params.orderId,
      order_amount: params.amount,
      order_currency: params.currency || 'INR',
      customer_details: {
        customer_id: customerId,
        customer_name: params.customerName.slice(0, 50),
        customer_email: params.customerEmail || 'support@lazyproof.online',
        customer_phone: params.customerPhone || '9999999999'
      },
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
        'x-api-version': '2023-08-01',
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
      amount: data.order_amount,
      currency: data.order_currency,
      status: data.order_status === 'PAID' ? 'PAID' : 'ACTIVE'
    };
  }

  /**
   * Cashfree PG Payment Status (API Version 2023-08-01)
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
        'x-api-version': '2023-08-01'
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
      return {
        orderId,
        status: 'PAID',
        providerPaymentId: String(successful.cf_payment_id),
        amount: Number(successful.payment_amount),
        currency: successful.payment_currency || 'INR',
        paymentMethod: successful.payment_group || 'UPI',
        raw: successful
      };
    }

    const failed = payments.find((p: any) => p.payment_status === 'FAILED');
    if (failed) {
      return { orderId, status: 'FAILED', raw: failed };
    }

    return { orderId, status: 'PENDING' };
  }

  /**
   * Cashfree PG Webhook Verification (API Version 2023-08-01)
   * Verifies HMAC-SHA256 signature using raw body and timestamp:
   * Algorithm: Base64(HMAC-SHA256(timestamp + rawBody, secretKey))
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

    // Replay attack prevention: verify timestamp freshness within 10 minutes
    const tsNum = Number(timestamp);
    if (!isNaN(tsNum)) {
      const tsMs = tsNum > 10000000000 ? tsNum : tsNum * 1000;
      const ageMs = Math.abs(Date.now() - tsMs);
      if (ageMs > 10 * 60 * 1000) {
        return { isValid: false, error: 'Webhook timestamp is outside acceptable 10-minute window.' };
      }
    }

    const secret = this.webhookSecret || this.secretKey;
    if (!secret) {
      return { isValid: false, error: 'Server webhook secret key is not configured.' };
    }

    try {
      const signedPayload = timestamp + rawBody;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('base64');

      const sigBuf = Buffer.from(signature.trim());
      const expectedBuf = Buffer.from(expectedSignature.trim());

      if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        return { isValid: false, error: 'Cryptographic HMAC signature mismatch.' };
      }

      // Parse verified body
      const body = JSON.parse(rawBody);
      const eventType = body.type || body.event;
      const order = body.data?.order || {};
      const payment = body.data?.payment || {};

      let status: 'SUCCESS' | 'FAILED' | 'USER_DROPPED' | 'REFUNDED' | undefined;
      if (eventType === 'PAYMENT_SUCCESS_WEBHOOK' || payment.payment_status === 'SUCCESS') {
        status = 'SUCCESS';
      } else if (eventType === 'PAYMENT_FAILED_WEBHOOK') {
        status = 'FAILED';
      } else if (eventType === 'PAYMENT_USER_DROPPED_WEBHOOK') {
        status = 'USER_DROPPED';
      } else if (eventType === 'REFUND_SUCCESS_WEBHOOK') {
        status = 'REFUNDED';
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
   * Cashfree PG Refund Request (API Version 2023-08-01)
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
        'x-api-version': '2023-08-01',
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
}

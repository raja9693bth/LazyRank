export interface CreateOrderParams {
  orderId: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  returnUrl?: string;
  notifyUrl?: string;
  note?: string;
  idempotencyKey?: string;
}

export interface ProviderOrderResult {
  orderId: string;
  providerOrderId?: string;
  paymentSessionId?: string;
  checkoutUrl?: string;
  idempotencyKey?: string;
  currency: string;
  amount: number;
  status: 'ACTIVE' | 'PAID' | 'FAILED' | 'PENDING';
}

export interface ProviderPaymentStatus {
  orderId: string;
  status: 'PAID' | 'PENDING' | 'FAILED' | 'USER_DROPPED' | 'CANCELLED';
  providerPaymentId?: string;
  amount?: number;
  currency?: string;
  paymentMethod?: string;
  raw?: any;
}

export interface RefundWebhookDetails {
  refundId: string;
  providerRefundId?: string;
  orderId: string;
  amount: number;
  currency: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  arn?: string;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  event?: string;
  orderId?: string;
  providerPaymentId?: string;
  amount?: number;
  currency?: string;
  paymentMethod?: string;
  status?: 'SUCCESS' | 'FAILED' | 'USER_DROPPED' | 'REFUNDED';
  refund?: RefundWebhookDetails;
  rawPayload?: any;
  error?: string;
}

export interface RefundRequestParams {
  orderId: string;
  refundId: string;
  amount: number;
  reason: string;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  raw?: any;
  error?: string;
}

export interface ProviderRefundStatus {
  orderId: string;
  merchantRefundId: string;
  providerRefundId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  amount: number;
  currency: string;
  raw?: any;
}

export interface PaymentProvider {
  name: string;
  isConfigured?(): boolean;
  createOrder(params: CreateOrderParams): Promise<ProviderOrderResult>;
  getPaymentStatus(orderId: string): Promise<ProviderPaymentStatus>;
  verifyWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>): Promise<WebhookVerificationResult>;
  createRefund(params: RefundRequestParams): Promise<RefundResult>;
  getRefundStatus(orderId: string, merchantRefundId: string): Promise<ProviderRefundStatus>;
}

/**
 * Strict minor-unit validator: finite, positive, safe integer paise, no sub-paise rounding.
 * Returns safe integer paise (e.g. 10000 for 100.00 INR), or null if invalid.
 */
export function toSafePaise(amt: unknown): number | null {
  if (typeof amt !== 'number' || !Number.isFinite(amt) || amt <= 0) return null;
  const paise = Math.round(amt * 100);
  if (!Number.isSafeInteger(paise)) return null;
  if (Math.abs(amt * 100 - paise) >= 1e-8) return null;
  return paise;
}

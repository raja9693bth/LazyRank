import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, Copy, Check, QrCode, Smartphone, Loader2, ArrowRight, ShieldCheck, ExternalLink } from 'lucide-react';
import { UserProfile } from '../types.ts';

interface PaymentModalProps {
  orderData: {
    orderId: string;
    name: string;
    amount: number;
    currency: string;
    isTop: boolean;
    topAmount: number;
    minAmountToBeatTop: number;
    profileId?: string;
    instagram?: string;
    linkedin?: string;
    website?: string;
    reason?: string;
    vpa: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (profile: UserProfile, previousTop?: UserProfile, ownerToken?: string) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  orderData,
  isOpen,
  onClose,
  onPaymentSuccess
}) => {
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [selectedApp, setSelectedApp] = useState<'gpay' | 'phonepe' | 'paytm' | 'qr'>('qr');
  const [step, setStep] = useState<'checkout' | 'verifying' | 'success' | 'error'>('checkout');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualTxnRef, setManualTxnRef] = useState('');

  if (!isOpen || !orderData) return null;

  const upiId = orderData.vpa || 'lazy@upi';
  const upiPayUrl = `upi://pay?pa=${upiId}&pn=LAZY%20Rank&am=${orderData.amount}&cu=INR&tn=LAZY%20Rank%20for%20${encodeURIComponent(orderData.name)}`;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  // Authoritative server-side verification
  const handleVerifyPayment = async (customRef?: string) => {
    setStep('verifying');
    setErrorMessage(null);

    const paymentRef = customRef || manualTxnRef.trim() || `UPI_${Date.now().toString(36).toUpperCase()}`;

    try {
      let storedOwnerToken: string | undefined;
      if (orderData.profileId) {
        try {
          const tokens = JSON.parse(localStorage.getItem('lazy_tokens') || '{}');
          storedOwnerToken = tokens[orderData.profileId];
        } catch {}
      }

      const res = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(storedOwnerToken ? { 'x-profile-token': storedOwnerToken } : {})
        },
        body: JSON.stringify({
          orderId: orderData.orderId,
          paymentReference: paymentRef,
          name: orderData.name,
          amount: orderData.amount,
          instagram: orderData.instagram,
          linkedin: orderData.linkedin,
          website: orderData.website,
          reason: orderData.reason,
          profileId: orderData.profileId,
          ownerToken: storedOwnerToken
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success || !data.profile) {
        throw new Error(data.error || 'Payment verification failed server-side.');
      }

      setStep('success');
      setTimeout(() => {
        onPaymentSuccess(data.profile, data.previousTop, data.ownerToken);
      }, 750);
    } catch (err: any) {
      setStep('error');
      setErrorMessage(err?.message || 'Could not verify payment. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-md rounded-2xl bg-white border border-zinc-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 bg-zinc-50/50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-zinc-900" />
            <h3 className="text-sm font-extrabold text-zinc-900 uppercase tracking-wider">
              Legitimacy Verification
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5">
          {step === 'checkout' && (
            <div className="space-y-4">
              {/* Order Summary Box */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-center">
                <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                  Amount to Verify Laziness
                </div>
                <div className="text-3xl font-mono-numbers font-black text-zinc-950 mt-1">
                  ₹{orderData.amount.toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-zinc-600 mt-1">
                  For: <strong className="text-zinc-900">{orderData.name}</strong>
                  {orderData.isTop && (
                    <span className="ml-1 text-amber-700 font-bold">(Will Take #1!)</span>
                  )}
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-2">
                  Select Payment Method (India UPI)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedApp('qr')}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      selectedApp === 'qr'
                        ? 'border-zinc-900 bg-zinc-900 text-white font-bold'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    <QrCode className="w-4 h-4 mb-1" />
                    <span className="text-[10px]">UPI QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedApp('gpay')}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      selectedApp === 'gpay'
                        ? 'border-zinc-900 bg-zinc-900 text-white font-bold'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 mb-1" />
                    <span className="text-[10px]">GPay</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedApp('phonepe')}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      selectedApp === 'phonepe'
                        ? 'border-zinc-900 bg-zinc-900 text-white font-bold'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 mb-1" />
                    <span className="text-[10px]">PhonePe</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedApp('paytm')}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      selectedApp === 'paytm'
                        ? 'border-zinc-900 bg-zinc-900 text-white font-bold'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 mb-1" />
                    <span className="text-[10px]">Paytm</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Payment Details Display */}
              {selectedApp === 'qr' ? (
                <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-zinc-200 bg-white">
                  {/* Generated SVG QR Code representation */}
                  <div className="p-3 bg-white border border-zinc-200 rounded-xl shadow-xs">
                    <svg className="w-36 h-36" viewBox="0 0 100 100" fill="none">
                      {/* Corner squares */}
                      <rect x="5" y="5" width="25" height="25" fill="#18181b" rx="3" />
                      <rect x="10" y="10" width="15" height="15" fill="white" rx="1" />
                      <rect x="13" y="13" width="9" height="9" fill="#18181b" />

                      <rect x="70" y="5" width="25" height="25" fill="#18181b" rx="3" />
                      <rect x="75" y="10" width="15" height="15" fill="white" rx="1" />
                      <rect x="78" y="13" width="9" height="9" fill="#18181b" />

                      <rect x="5" y="70" width="25" height="25" fill="#18181b" rx="3" />
                      <rect x="10" y="75" width="15" height="15" fill="white" rx="1" />
                      <rect x="13" y="78" width="9" height="9" fill="#18181b" />

                      {/* Data dots pattern */}
                      <rect x="35" y="8" width="6" height="6" fill="#18181b" />
                      <rect x="45" y="12" width="6" height="6" fill="#18181b" />
                      <rect x="55" y="8" width="6" height="6" fill="#18181b" />
                      <rect x="35" y="22" width="6" height="6" fill="#18181b" />
                      <rect x="50" y="24" width="6" height="6" fill="#18181b" />

                      <rect x="8" y="38" width="6" height="6" fill="#18181b" />
                      <rect x="18" y="48" width="6" height="6" fill="#18181b" />
                      <rect x="28" y="38" width="6" height="6" fill="#18181b" />
                      <rect x="38" y="44" width="8" height="8" fill="#d97706" rx="2" />
                      <rect x="52" y="38" width="6" height="6" fill="#18181b" />
                      <rect x="68" y="46" width="6" height="6" fill="#18181b" />
                      <rect x="82" y="38" width="6" height="6" fill="#18181b" />

                      <rect x="36" y="65" width="6" height="6" fill="#18181b" />
                      <rect x="48" y="75" width="6" height="6" fill="#18181b" />
                      <rect x="60" y="65" width="6" height="6" fill="#18181b" />
                      <rect x="75" y="75" width="6" height="6" fill="#18181b" />
                      <rect x="85" y="85" width="6" height="6" fill="#18181b" />
                    </svg>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-medium mt-2">
                    Scan with any UPI app (GPay, PhonePe, Paytm, BHIM)
                  </span>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 text-center">
                  <p className="text-xs text-zinc-600 font-medium mb-3">
                    Open {selectedApp.toUpperCase()} directly on mobile:
                  </p>
                  <a
                    href={upiPayUrl}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-950 text-white text-xs font-bold shadow-xs hover:bg-zinc-800 transition-colors"
                  >
                    <span>Launch {selectedApp.toUpperCase()} App</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* UPI ID copy field */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 bg-zinc-50">
                <div className="text-xs text-zinc-600 font-mono-numbers">
                  UPI ID: <strong className="text-zinc-900">{upiId}</strong>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-100 transition-all cursor-pointer"
                >
                  {copiedUpi ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Server Verification Action */}
              <div className="pt-2 border-t border-zinc-100">
                <button
                  id="confirm-verified-payment-btn"
                  type="button"
                  onClick={() => handleVerifyPayment()}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-xs transition-all active:scale-98 cursor-pointer"
                >
                  <span>I HAVE PAID ₹{orderData.amount.toLocaleString('en-IN')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-[11px] text-zinc-400 text-center mt-2">
                  Server verifies receipt before granting official public rank.
                </p>
              </div>
            </div>
          )}

          {step === 'verifying' && (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-950 mx-auto" />
              <h4 className="text-sm font-extrabold text-zinc-900">
                Verifying Legitimacy on Server...
              </h4>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                Validating transaction reference and calculating your authoritative public rank.
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="py-12 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto animate-bounce" />
              <h4 className="text-base font-extrabold text-zinc-900">
                Legitimacy Verified!
              </h4>
              <p className="text-xs text-zinc-500">
                Preparing your official share card...
              </p>
            </div>
          )}

          {step === 'error' && (
            <div className="py-8 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
              <h4 className="text-sm font-extrabold text-zinc-900">
                Verification Failed
              </h4>
              <p className="text-xs text-rose-600 max-w-xs mx-auto">
                {errorMessage}
              </p>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => setStep('checkout')}
                  className="px-4 py-2 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

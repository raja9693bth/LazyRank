import React, { useState } from 'react';
import { LegalPageLayout } from '../components/LegalPageLayout';
import { LEGAL_CONFIG } from '../config/legal';
import { Mail, ShieldCheck, AlertCircle, CheckCircle, Send, Clock, Phone, MapPin, Lock } from 'lucide-react';

interface ContactPageProps {
  onNavigate: (path: string) => void;
}

export const ContactPage: React.FC<ContactPageProps> = ({ onNavigate }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Payment / Rank Claim Issue');
  const [orderId, setOrderId] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !email.trim() || !message.trim()) {
      setErrorMessage('Please fill in your name, email address, and message.');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject,
          orderId: orderId.trim() || undefined,
          message: message.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit inquiry. Please try again or email us directly.');
      }

      setSubmitted(true);
      setName('');
      setEmail('');
      setOrderId('');
      setMessage('');
    } catch (err: any) {
      setErrorMessage(err.message || `Something went wrong. Please email ${LEGAL_CONFIG.SUPPORT_EMAIL} directly.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LegalPageLayout
      title="Contact & Customer Support"
      subtitle={`Have a question about your rank, payment verification, duplicate charge, or content moderation? Contact the ${LEGAL_CONFIG.LEGAL_BUSINESS_NAME} team.`}
      lastUpdated="September 24, 2026"
      currentPath="/contact"
      onNavigate={onNavigate}
    >
      {/* Official Business Identity Information */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-2">
        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
          <div className="flex items-center gap-2 text-zinc-950 font-bold text-sm">
            <Mail className="w-4 h-4 text-amber-600" />
            <span>Direct Support Channels</span>
          </div>
          <div className="text-xs text-zinc-600 space-y-1.5">
            <div>
              <span className="text-zinc-500">Email:</span>{' '}
              <a
                href={`mailto:${LEGAL_CONFIG.SUPPORT_EMAIL}`}
                className="font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300 hover:bg-amber-200 transition-colors"
              >
                {LEGAL_CONFIG.SUPPORT_EMAIL}
              </a>
            </div>
            <div>
              <span className="text-zinc-500">Phone:</span>{' '}
              <a href={`tel:${LEGAL_CONFIG.SUPPORT_PHONE}`} className="font-semibold text-zinc-900 hover:underline">
                {LEGAL_CONFIG.SUPPORT_PHONE}
              </a>
            </div>
            <div className="flex items-start gap-1 text-[11px] text-zinc-500 pt-1">
              <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Hours: {LEGAL_CONFIG.BUSINESS_HOURS}</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
          <div className="flex items-center gap-2 text-zinc-950 font-bold text-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Operating Entity Details</span>
          </div>
          <div className="text-xs text-zinc-700 space-y-1">
            <div>
              <strong>Enterprise:</strong> {LEGAL_CONFIG.LEGAL_BUSINESS_NAME}
            </div>
            <div>
              <strong>Entity Type:</strong> {LEGAL_CONFIG.ENTITY_TYPE}
            </div>
            <div className="flex items-start gap-1 text-[11px] text-zinc-500 pt-0.5">
              <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-zinc-400" />
              <span>{LEGAL_CONFIG.PUBLIC_BUSINESS_ADDRESS}</span>
            </div>
            <div className="text-[11px] text-zinc-400">
              Jurisdiction: Republic of India
            </div>
          </div>
        </div>
      </div>

      {/* When to Contact Support */}
      <section className="space-y-2 mt-6">
        <h2 className="text-base font-bold text-zinc-950">
          What We Can Help You With:
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-700">
          <li className="p-2.5 rounded-lg bg-white border border-zinc-200">
            <strong>1. Payment & Rank Verification:</strong> Resolving unconfirmed debits or delayed rank updates.
          </li>
          <li className="p-2.5 rounded-lg bg-white border border-zinc-200">
            <strong>2. Duplicate Debits:</strong> Reconciling accidental duplicate transactions for full refunds.
          </li>
          <li className="p-2.5 rounded-lg bg-white border border-zinc-200">
            <strong>3. Content Moderation:</strong> Reporting abusive, defamatory, or infringing profile entries.
          </li>
          <li className="p-2.5 rounded-lg bg-white border border-zinc-200">
            <strong>4. Profile Updates & Inquiries:</strong> Updating profile statements or general platform questions.
          </li>
        </ul>
      </section>

      {/* Interactive Contact Form */}
      <section className="mt-8 pt-6 border-t border-zinc-200">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-zinc-950">
            Send an On-Site Message
          </h2>
          <p className="text-xs text-zinc-600">
            Fill out the form below. We review support inquiries during published business hours and aim to respond as soon as reasonably possible.
          </p>
        </div>

        {submitted ? (
          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs sm:text-sm space-y-2">
            <div className="flex items-center gap-2 font-black text-emerald-900 text-base">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span>Inquiry Received Successfully!</span>
            </div>
            <p className="leading-relaxed">
              Thank you for reaching out. We have received your message. Our support desk ({LEGAL_CONFIG.SUPPORT_EMAIL}) reviews inquiries during published business hours and aims to respond as soon as reasonably possible.
            </p>
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer"
            >
              Send Another Message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs">
            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="contact-name" className="block text-xs font-bold text-zinc-800 mb-1">
                  Your Full Name *
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950"
                />
              </div>

              <div>
                <label htmlFor="contact-email" className="block text-xs font-bold text-zinc-800 mb-1">
                  Your Email Address *
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. rahul@example.com"
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="contact-subject" className="block text-xs font-bold text-zinc-800 mb-1">
                  Topic / Category *
                </label>
                <select
                  id="contact-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950 bg-white"
                >
                  <option value="Payment / Rank Claim Issue">Payment / Rank Claim Issue</option>
                  <option value="Refund / Cancellation Request">Refund / Cancellation Request</option>
                  <option value="Duplicate Charge Inquiry">Duplicate Charge Inquiry</option>
                  <option value="Content Moderation / Report Query">Content Moderation / Report Query</option>
                  <option value="Technical Bug">Technical Issue / Bug Report</option>
                  <option value="General Inquiry">General Inquiry</option>
                </select>
              </div>

              <div>
                <label htmlFor="contact-order" className="block text-xs font-bold text-zinc-800 mb-1">
                  Order ID or Profile Name <span className="text-zinc-400 font-normal">(Optional)</span>
                </label>
                <input
                  id="contact-order"
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="e.g. order_abc123 or Rank #4"
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950"
                />
              </div>
            </div>

            <div>
              <label htmlFor="contact-message" className="block text-xs font-bold text-zinc-800 mb-1">
                Detailed Message *
              </label>
              <textarea
                id="contact-message"
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your issue with transaction dates, amounts, or profile details..."
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:border-zinc-950"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <span>
                  Protected under our{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate('/privacy')}
                    className="underline text-zinc-700 hover:text-zinc-950 cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                  .
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-black tracking-wide shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Sending...' : 'Send Message'}</span>
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Security Warning Notice */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs mt-6 flex items-start gap-2.5">
        <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <strong className="block text-amber-900 font-bold mb-0.5">Security Notice</strong>
          <span>
            {LEGAL_CONFIG.LEGAL_BUSINESS_NAME} representatives will <strong>NEVER</strong> ask for your UPI PIN, ATM PIN, net-banking passwords, or card CVV. Never disclose sensitive financial credentials to anyone.
          </span>
        </div>
      </div>
    </LegalPageLayout>
  );
};

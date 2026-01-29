import Stripe from 'stripe';

// Lazy initialization for Stripe client
let _stripe: Stripe | null = null;

export const getStripe = () => {
  if (!_stripe) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      throw new Error(
        'Missing STRIPE_SECRET_KEY environment variable.'
      );
    }

    _stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-09-30.clover',
    });
  }
  return _stripe;
};

// For backward compatibility - use getStripe() for new code
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as unknown as Record<string, unknown>)[prop as string];
  },
});

export const STRIPE_PRICE_ID =
  process.env.STRIPE_PRICE_ID || 'price_snipit_pro_monthly';

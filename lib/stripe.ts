import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

export const PLANS = {
  pro: { name: "Pro", amount: 999, interval: "month" as const },
  enterprise: { name: "Enterprise", amount: 2999, interval: "month" as const },
};

---
name: stripe-integration
description: "Stripe payment integration patterns for checkout, subscriptions, webhooks, and customer portal. Use when implementing payments, building SaaS billing, handling Stripe webhooks, creating checkout flows, or managing subscription lifecycle."
---

# Stripe Integration

## Critical Rules

- **Always use Stripe Checkout or Payment Elements** — never collect card details directly.
- **Always verify webhook signatures** — never trust unverified payloads.
- **Never expose `STRIPE_SECRET_KEY` to the client** — server-side only.
- **Make webhook handlers idempotent** — the same event may arrive multiple times.
- **Use `metadata` to link Stripe objects to database records** — always pass `userId`, `orderId`.
- **Use `idempotencyKey` for critical operations** — prevent duplicate charges.

## Setup

- Install `stripe` (server) and `@stripe/stripe-js` + `@stripe/react-stripe-js` (client).
- Store keys in environment variables:
  - `STRIPE_SECRET_KEY` — server-side only, never expose to client
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — safe for client-side
  - `STRIPE_WEBHOOK_SECRET` — for verifying webhook signatures
- Create a Stripe instance in `src/lib/stripe.ts`:
  ```ts
  import Stripe from 'stripe'
  export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  ```

## Checkout

- Always use Stripe Checkout or Payment Elements — never collect card details directly.
- Create a Checkout Session server-side, redirect client-side:
  ```ts
  const session = await stripe.checkout.sessions.create({
    mode: 'payment', // or 'subscription'
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/cart`,
    metadata: { userId, orderId },
  })
  ```
- Use `metadata` to link Stripe objects back to your database records.
- For subscriptions, use `mode: 'subscription'` with recurring prices.

## Webhooks

- Create a webhook endpoint at `/api/webhooks/stripe`:
  ```ts
  const sig = request.headers.get('stripe-signature')!
  const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  ```
- Always verify webhook signatures. Never trust unverified payloads.
- Handle these critical events:
  - `checkout.session.completed` — fulfill the order
  - `invoice.payment_succeeded` — extend subscription
  - `invoice.payment_failed` — notify user, retry logic
  - `customer.subscription.deleted` — revoke access
- Make webhook handlers idempotent — the same event may arrive multiple times.
- Return 200 quickly. Process heavy logic asynchronously if needed.

## Products & Prices

- Define products and prices in Stripe Dashboard for simplicity.
- Use `price` IDs (not `product` IDs) when creating Checkout Sessions.
- For multiple pricing tiers, create one product with multiple prices (monthly/yearly).
- Sync product/price data to your database via webhooks or a scheduled job.

## Customer Portal

- Use Stripe Customer Portal for subscription management (upgrade, downgrade, cancel, update payment method).
- Create a portal session and redirect:
  ```ts
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/account`,
  })
  ```

## Security

- Never log or store raw card numbers, CVV, or full card details.
- Use Stripe's PCI-compliant elements for all card input.
- Validate amounts and currencies server-side before creating charges.
- Use `idempotencyKey` for critical operations to prevent duplicate charges.
- Restrict Stripe API key permissions in production (read-only where possible).

## Testing

- Use Stripe test mode keys during development.
- Use test card numbers: `4242424242424242` (success), `4000000000000002` (decline).
- Use Stripe CLI to forward webhooks to localhost:
  ```bash
  stripe listen --forward-to localhost:3000/api/webhooks/stripe
  ```
- Test all webhook event types, especially failure scenarios.

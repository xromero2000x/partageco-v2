/**
 * Provider-agnostic payment types and checkout session factory.
 *
 * MVP mode: PAYMENT_PROVIDER env var absent or "simulation" → no real payment.
 * Future: set PAYMENT_PROVIDER="stripe_connect" or "mangopay" with matching SDK keys.
 */

export type PaymentProviderName = "simulation" | "stripe_connect" | "mangopay";

export interface CreateCheckoutInput {
  paymentRecordId: string;
  coSubscriptionId: string;
  payerUserId: string;
  payeeUserId: string;
  amount: number;
  currency: "EUR";
  successUrl: string;
  cancelUrl: string;
}

export interface CreateCheckoutResult {
  mode: "simulation" | "real";
  providerName: PaymentProviderName;
  providerReference: string | null;
  checkoutUrl: string | null;
}

export function getActiveProvider(): PaymentProviderName {
  const raw = process.env["PAYMENT_PROVIDER"] ?? "simulation";
  if (raw === "simulation" || raw === "stripe_connect" || raw === "mangopay") {
    return raw as PaymentProviderName;
  }
  throw new Error("payment_provider_unknown");
}

export async function createCheckoutSession(
  input: CreateCheckoutInput
): Promise<CreateCheckoutResult> {
  const provider = (() => {
    try {
      return getActiveProvider();
    } catch {
      throw new Error("payment_provider_unknown");
    }
  })();

  if (provider === "simulation") {
    return {
      mode: "simulation",
      providerName: "simulation",
      providerReference: null,
      checkoutUrl: null,
    };
  }

  if (provider === "stripe_connect") {
    const key = process.env["STRIPE_SECRET_KEY"];
    if (!key) throw new Error("payment_provider_not_configured");
    // Real Stripe integration goes here — not activated in MVP.
    throw new Error("payment_provider_not_configured");
  }

  if (provider === "mangopay") {
    const clientId = process.env["MANGOPAY_CLIENT_ID"];
    const apiKey = process.env["MANGOPAY_API_KEY"];
    if (!clientId || !apiKey) throw new Error("payment_provider_not_configured");
    // Real Mangopay integration goes here — not activated in MVP.
    throw new Error("payment_provider_not_configured");
  }

  throw new Error("payment_provider_unknown");
}

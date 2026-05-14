import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

export interface MarketplaceOfferLike {
  id: string;
  title: string;
  monthly_price_amount: number | string;
  currency: string;
  available_slots: number;
  service_slug: string | null;
  service_name: string | null;
  plan_name: string | null;
  category_name?: string | null;
  description?: string | null;
  created_at?: string;
  owner_user_id?: string;
  owner_display_name?: string | null;
  owner_member_since?: string | null;
  owner_email_verified?: boolean;
}

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function memberSinceLabel(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function initials(name?: string | null) {
  if (!name) return "?";
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

// Deterministic color from owner id (or name) so each vendor has a unique avatar tint.
const AVATAR_GRADIENTS = [
  "from-rose-400 to-pink-600",
  "from-amber-400 to-orange-600",
  "from-emerald-400 to-teal-600",
  "from-sky-400 to-indigo-600",
  "from-violet-400 to-fuchsia-600",
  "from-cyan-400 to-blue-600",
  "from-lime-400 to-green-600",
  "from-yellow-400 to-amber-600",
];
function gradientFor(seed?: string | null) {
  if (!seed) return AVATAR_GRADIENTS[0];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

export function OfferCard({ offer }: { offer: MarketplaceOfferLike }) {
  const slots = offer.available_slots;
  const ownerName = offer.owner_display_name ?? "Membre";
  const memberSince = memberSinceLabel(offer.owner_member_since);
  const gradient = gradientFor(offer.owner_user_id ?? ownerName);
  const lastSlot = slots <= 1;

  return (
    <Link
      to="/offres/$offerId"
      params={{ offerId: offer.id }}
      className="group flex flex-col items-center rounded-2xl border border-border bg-card p-6 text-center transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
    >
      {/* Avatar — central visual element, spliiit-style */}
      <div
        aria-hidden="true"
        className={`flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-2xl font-semibold text-white shadow-md ring-4 ring-background`}
      >
        {initials(ownerName)}
      </div>

      {/* Owner name + verified badge */}
      <div className="mt-4 flex items-center gap-1.5">
        <p className="text-base font-semibold text-foreground">{ownerName}</p>
        {offer.owner_email_verified && (
          <ShieldCheck
            className="h-4 w-4 text-primary"
            aria-label="Email vérifié"
          />
        )}
      </div>

      {memberSince && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          Membre depuis {memberSince}
        </p>
      )}

      {/* Service partagé */}
      <p className="mt-3 text-sm text-foreground">
        Partage{" "}
        <span className="font-semibold">
          {offer.service_name ?? "un abonnement"}
        </span>
        {offer.plan_name && (
          <span className="text-muted-foreground"> · {offer.plan_name}</span>
        )}
      </p>

      {/* Price */}
      <div className="mt-4">
        <p className="text-3xl font-bold tracking-tight text-foreground">
          {formatAmount(Number(offer.monthly_price_amount), offer.currency)}
        </p>
        <p className="-mt-1 text-xs text-muted-foreground">/mois</p>
      </div>

      {/* CTA */}
      <span className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition group-hover:bg-primary group-hover:text-primary-foreground">
        Rejoindre
      </span>

      {/* Slots indicator */}
      <p
        className={`mt-3 inline-flex items-center gap-1.5 text-xs font-medium ${
          lastSlot ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-2 w-2 rounded-full ${
            lastSlot ? "bg-amber-500" : "bg-emerald-500"
          }`}
        />
        {lastSlot
          ? "Dernière place disponible"
          : `${slots} places disponibles`}
      </p>
    </Link>
  );
}

import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { getServiceVisual } from "./serviceVisuals";

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
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export function OfferCard({ offer }: { offer: MarketplaceOfferLike }) {
  const visual = getServiceVisual(offer.service_slug);
  const slots = offer.available_slots;
  const ownerName = offer.owner_display_name ?? "Membre";
  const memberSince = memberSinceLabel(offer.owner_member_since);

  return (
    <Link
      to="/offres/$offerId"
      params={{ offerId: offer.id }}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
        {visual ? (
          <img
            src={visual}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            aria-hidden="true"
            className="h-full w-full bg-gradient-to-br from-primary/30 via-primary/10 to-background"
          />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">
              {offer.service_name ?? "Service"}
            </span>
            {offer.plan_name && (
              <span className="rounded-full border border-border bg-background/80 px-2 py-0.5 text-[11px] font-medium text-foreground">
                {offer.plan_name}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Owner block — primary trust signal */}
        <div className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary text-sm font-semibold text-primary-foreground"
          >
            {initials(ownerName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-semibold text-foreground">
                {ownerName}
              </p>
              {offer.owner_email_verified && (
                <span
                  title="Email vérifié"
                  aria-label="Email vérifié"
                  className="inline-flex items-center text-primary"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
            {memberSince && (
              <p className="truncate text-[11px] text-muted-foreground">
                Membre depuis {memberSince}
              </p>
            )}
          </div>
        </div>

        <h3 className="line-clamp-2 text-sm font-medium text-foreground">
          {offer.title}
        </h3>
        {offer.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{offer.description}</p>
        )}

        <div className="mt-auto flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              à partir de
            </p>
            <p className="text-base font-semibold text-foreground">
              {formatAmount(Number(offer.monthly_price_amount), offer.currency)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                /mois
              </span>
            </p>
          </div>
          <span
            className={`rounded-md px-2 py-1 text-xs font-medium ${
              slots <= 1
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            }`}
          >
            {slots <= 1 ? "Dernière place" : `${slots} places`}
          </span>
        </div>

        <span className="mt-2 inline-flex w-fit items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition group-hover:border-primary group-hover:text-primary">
          Rejoindre →
        </span>
      </div>
    </Link>
  );
}

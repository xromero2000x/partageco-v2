import { Link } from "@tanstack/react-router";
import { getServiceVisual } from "./serviceVisuals";

export interface ServiceAggregate {
  slug: string;
  name: string;
  categoryName?: string;
  offersCount: number;
  totalSlots: number;
  minPrice: number;
  currency: string;
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

export function ServiceCard({ service }: { service: ServiceAggregate }) {
  const visual = getServiceVisual(service.slug);

  return (
    <Link
      to="/marketplace/service/$serviceSlug"
      params={{ serviceSlug: service.slug }}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
      aria-label={`Voir les offres ${service.name}`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
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
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{service.name}</h3>
          {service.categoryName && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{service.categoryName}</p>
          )}
        </div>

        <ul className="space-y-0.5 text-xs text-muted-foreground">
          <li>
            {service.offersCount} offre{service.offersCount > 1 ? "s" : ""}
          </li>
          <li>
            {service.totalSlots} place{service.totalSlots > 1 ? "s" : ""}
          </li>
          <li>
            Dès{" "}
            <span className="font-medium text-foreground">
              {formatAmount(service.minPrice, service.currency)}
            </span>
            /mois
          </li>
        </ul>

        <span className="mt-auto inline-flex w-fit items-center rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground transition group-hover:border-primary group-hover:text-primary">
          Voir →
        </span>
      </div>
    </Link>
  );
}

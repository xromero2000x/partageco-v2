import { Link } from "@tanstack/react-router";
import { getServiceBranding } from "./serviceBranding";

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
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function ServiceCard({ service }: { service: ServiceAggregate }) {
  const branding = getServiceBranding(service.slug);

  return (
    <Link
      to="/marketplace/service/$serviceSlug"
      params={{ serviceSlug: service.slug }}
      aria-label={`Voir les offres ${service.name}`}
      className="group relative flex aspect-[3/4] w-full flex-col items-center justify-between overflow-hidden rounded-2xl p-5 shadow-md ring-1 ring-white/5 transition hover:-translate-y-0.5 hover:shadow-xl"
      style={{ background: branding.background, color: branding.foreground }}
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h3
          className="px-1 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl"
          style={{ color: branding.foreground }}
        >
          {service.name}
        </h3>
        <div
          aria-hidden="true"
          className="mx-auto mt-3 h-px w-10"
          style={{ background: branding.accent }}
        />
        <p className="mt-4 text-2xl font-bold sm:text-3xl" style={{ color: branding.foreground }}>
          {formatAmount(service.minPrice, service.currency)}
        </p>
        <p className="mt-0.5 text-xs" style={{ color: branding.accent }}>
          / mois
        </p>
      </div>

      <div
        className="mt-2 text-xs font-semibold tracking-wide opacity-90 transition group-hover:opacity-100"
        style={{ color: branding.foreground }}
      >
        Participer →
      </div>
    </Link>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { listMarketplaceOffers } from "@/lib/offers.functions";
import type { MarketplaceOfferLike } from "@/components/marketplace/OfferCard";
import { ServiceCard, type ServiceAggregate } from "@/components/marketplace/ServiceCard";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  DISPLAY_CATEGORIES,
  MVP_NOTICE,
  NON_AFFILIATION_NOTICE,
} from "@/components/marketplace/serviceVisuals";

type OfferWithCreated = MarketplaceOfferLike & { created_at?: string };

export const Route = createFileRoute("/marketplace")({
  loader: () => listMarketplaceOffers(),
  component: MarketplacePage,
  head: () => ({
    meta: [
      { title: "Marketplace — PartageCo" },
      {
        name: "description",
        content:
          "Parcourez les offres de co-abonnement par catégorie et par service. Simulation MVP — aucun paiement réel n'est exécuté.",
      },
    ],
  }),
});

function aggregateByService(offers: OfferWithCreated[]): Map<string, ServiceAggregate> {
  const map = new Map<string, ServiceAggregate>();
  for (const o of offers) {
    if (!o.service_slug) continue;
    const price = Number(o.monthly_price_amount);
    const existing = map.get(o.service_slug);
    if (existing) {
      existing.offersCount += 1;
      existing.totalSlots += o.available_slots;
      if (price < existing.minPrice) existing.minPrice = price;
    } else {
      map.set(o.service_slug, {
        slug: o.service_slug,
        name: o.service_name ?? o.service_slug,
        categoryName: o.category_name ?? undefined,
        offersCount: 1,
        totalSlots: o.available_slots,
        minPrice: price,
        currency: o.currency,
      });
    }
  }
  return map;
}

function MarketplacePage() {
  const { offers } = Route.useLoaderData() as { offers: OfferWithCreated[] };
  const { isAuthenticated } = useAuth();
  const aggregates = aggregateByService(offers);

  const sections = DISPLAY_CATEGORIES.map((cat) => {
    const services = cat.serviceSlugs
      .map((s) => aggregates.get(s))
      .filter((s): s is ServiceAggregate => Boolean(s));
    return { ...cat, services };
  }).filter((s) => s.services.length > 0);

  const isEmpty = sections.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-6 py-10">

        {/* Hero */}
        <h1 className="text-3xl font-semibold tracking-tight">
          Trouver une place dans un abonnement partagé
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Choisissez un service, comparez les offres disponibles, puis demandez à rejoindre un abonnement partagé.
        </p>

        <div
          role="note"
          className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
        >
          <strong className="font-medium text-foreground">{MVP_NOTICE}</strong>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{NON_AFFILIATION_NOTICE}</p>

        {isEmpty ? (
          <section
            className="mt-10 rounded-lg border border-dashed border-border p-10 text-center"
            aria-label="Aucune offre disponible"
          >
            <h2 className="text-base font-medium">Aucune offre disponible pour le moment.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Revenez plus tard ou créez votre propre offre si vous souhaitez partager un abonnement.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              {isAuthenticated ? (
                <Link
                  to="/mes-offres/nouvelle"
                  className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Créer une offre
                </Link>
              ) : (
                <Link
                  to="/signup"
                  className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Créer un compte
                </Link>
              )}
            </div>
          </section>
        ) : (
          <div className="mt-10 space-y-14">
            {sections.map((section) => (
              <section key={section.key} aria-labelledby={`cat-${section.key}`}>
                <h2
                  id={`cat-${section.key}`}
                  className="text-xl font-semibold tracking-tight"
                >
                  {section.name}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {section.services.length} service
                  {section.services.length > 1 ? "s" : ""} avec offres disponibles
                </p>
                <Carousel
                  opts={{ align: "start", dragFree: true }}
                  className="mt-5 px-1"
                  aria-label={`Services ${section.name}`}
                >
                  <CarouselContent className="-ml-4">
                    {section.services.map((s) => (
                      <CarouselItem
                        key={s.slug}
                        className="basis-[85%] sm:basis-1/2 lg:basis-1/3"
                      >
                        <ServiceCard service={s} />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {section.services.length > 1 && (
                    <>
                      <CarouselPrevious className="hidden sm:flex -left-4 lg:-left-12" />
                      <CarouselNext className="hidden sm:flex -right-4 lg:-right-12" />
                    </>
                  )}
                </Carousel>
              </section>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}

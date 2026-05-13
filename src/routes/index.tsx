import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRight, ShieldCheck, Users, MessagesSquare } from "lucide-react";
import { listMarketplaceOffers } from "@/lib/offers.functions";
import { ServiceCard, type ServiceAggregate } from "@/components/marketplace/ServiceCard";
import { DISPLAY_CATEGORIES, NON_AFFILIATION_NOTICE } from "@/components/marketplace/serviceVisuals";
import type { MarketplaceOfferLike } from "@/components/marketplace/OfferCard";

type OfferWithCreated = MarketplaceOfferLike & { created_at?: string };

export const Route = createFileRoute("/")({
  loader: () => listMarketplaceOffers(),
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "PartageCo — Le meilleur du co-abonnement" },
      {
        name: "description",
        content:
          "PartageCo : marketplace de co-abonnement entre particuliers. Simulation MVP — aucun paiement réel n'est exécuté.",
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

function LandingPage() {
  const { isAuthenticated } = useAuth();
  const { offers } = Route.useLoaderData() as { offers: OfferWithCreated[] };

  const carouselServices = useMemo(() => {
    const aggregates = aggregateByService(offers);
    const ordered: ServiceAggregate[] = [];
    for (const cat of DISPLAY_CATEGORIES) {
      for (const slug of cat.serviceSlugs) {
        const agg = aggregates.get(slug);
        if (agg) ordered.push({ ...agg, categoryName: agg.categoryName ?? cat.name });
      }
    }
    return ordered;
  }, [offers]);

  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">

      {/* Hero */}
      <main>
        <section className="relative">
          <div className="mx-auto max-w-3xl px-6 pt-24 pb-16 text-center sm:pt-32">
            <h1 className="font-display text-3xl font-medium leading-[1.1] sm:text-5xl lg:text-6xl">
              Payez vos abonnements moins cher en partageant les frais.
              <br />
              <span className="brand-wordmark italic">Netflix, Disney+, Spotify...</span>
            </h1>
            <div
              aria-hidden="true"
              className="mx-auto mt-6 h-px w-16 bg-primary/70"
            />
            <p className="mx-auto mt-8 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Proposez vos places vacantes à la communauté ou profitez d'un
              abonnement déjà actif à prix réduit — simplement, dans un cadre
              clair.
            </p>

            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Button
                asChild
                size="lg"
                className="group rounded-full px-8 py-6 text-base glow-fuchsia"
              >
                <Link to="/marketplace">
                  Découvrir les offres
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>

            <div
              role="note"
              aria-label="Avertissement simulation"
              className="mx-auto mt-10 max-w-xl rounded-md border border-border/70 bg-card/50 p-3 text-xs text-muted-foreground backdrop-blur"
            >
              <strong className="font-medium text-foreground">
                Simulation MVP — aucun paiement réel n'est exécuté.
              </strong>
            </div>
          </div>

          {/* Trust strip */}
          <div className="mx-auto max-w-5xl px-6 pb-20">
            <div className="grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-3">
              <TrustItem
                icon={<ShieldCheck className="h-5 w-5 text-primary" />}
                title="Cadre clair"
                subtitle="Règles transparentes"
              />
              <TrustItem
                icon={<Users className="h-5 w-5 text-primary" />}
                title="Entre particuliers"
                subtitle="Comptes vérifiés par e-mail"
              />
              <TrustItem
                icon={<MessagesSquare className="h-5 w-5 text-primary" />}
                title="Échanges en contexte"
                subtitle="Messagerie liée à chaque offre"
              />
            </div>
          </div>
        </section>

        {/* Carrousel des services */}
        {carouselServices.length > 0 && (
          <section
            aria-labelledby="services-carousel-heading"
            className="border-t border-border/60 bg-muted/20 py-16"
          >
            <div className="mx-auto max-w-6xl px-6">
              <div className="mb-8 text-center">
                <h2
                  id="services-carousel-heading"
                  className="font-display text-2xl font-medium sm:text-3xl"
                >
                  Les services les plus partagés
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Explorez les abonnements proposés par les membres PartageCo.
                </p>
              </div>

              <div
                role="list"
                aria-label="Services disponibles sur PartageCo"
                className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-none"
                tabIndex={0}
              >
                {carouselServices.map((service) => (
                  <div
                    key={service.slug}
                    role="listitem"
                    className="w-64 flex-none snap-start sm:w-72"
                  >
                    <ServiceCard service={service} />
                  </div>
                ))}
              </div>

              <p className="mt-5 text-xs text-muted-foreground">
                {NON_AFFILIATION_NOTICE}
              </p>
            </div>
          </section>
        )}

        {/* Comment ça marche */}
        <section
          id="comment-ca-marche"
          className="mx-auto max-w-5xl px-6 py-24"
        >
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
              Comment ça marche
            </p>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl">
              Trois étapes, <span className="brand-wordmark italic">zéro friction</span>
            </h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            <Step
              n="01"
              title="Créez votre compte"
              text="Inscription par e-mail. Une vérification d'adresse est requise avant d'accéder aux actions de la marketplace."
            />
            <Step
              n="02"
              title="Publiez ou rejoignez"
              text="Proposez une place sur un abonnement que vous détenez, ou envoyez une demande de participation à une offre existante."
            />
            <Step
              n="03"
              title="Échangez en contexte"
              text="Une messagerie liée à chaque offre, participation ou litige. Aucune conversation libre, aucun chat hors contexte."
            />
          </div>
        </section>

        {/* Contact */}
        <section
          id="contact"
          className="mx-auto max-w-3xl px-6 pb-24 text-center"
        >
          <h2 className="font-display text-3xl sm:text-4xl">
            Une question ?
          </h2>
          <p className="mt-4 text-sm text-muted-foreground">
            PartageCo est en phase de simulation MVP. Pour toute remarque sur les
            parcours fonctionnels, créez un compte et utilisez la messagerie
            interne liée à votre offre ou participation.
          </p>
          <div className="mt-8">
            {!isAuthenticated ? (
              <Button asChild size="lg" className="rounded-full">
                <Link to="/signup">Créer un compte</Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="rounded-full">
                <Link to="/messages">Ouvrir la messagerie</Link>
              </Button>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-6 text-xs text-muted-foreground">
          <span>© PartageCo</span>
          <span>Simulation MVP — aucun paiement réel n'est exécuté.</span>
        </div>
      </footer>
    </div>
  );
}

function TrustItem({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-background/80 px-6 py-5 backdrop-blur">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
        {icon}
      </div>
      <div className="text-left">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </div>
  );
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <article className="rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur">
      <div className="font-display text-3xl italic text-primary">{n}</div>
      <h3 className="mt-3 text-lg font-medium">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </article>
  );
}

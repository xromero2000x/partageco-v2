import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getPublicOffer } from "@/lib/offers.functions";
import {
  getOfferActionAvailability,
  requestParticipation,
} from "@/lib/participations.functions";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  getServiceVisual,
  NON_AFFILIATION_NOTICE,
} from "@/components/marketplace/serviceVisuals";

export const Route = createFileRoute("/offres/$offerId")({
  loader: async ({ params }) => {
    try {
      return await getPublicOffer({ data: { offerId: params.offerId } });
    } catch {
      throw notFound();
    }
  },
  component: PublicOfferPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">Offre introuvable</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Cette offre n'existe pas ou n'est plus publique.
      </p>
      <Link to="/marketplace" className="mt-6 inline-block text-sm underline">
        Retour à la marketplace
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">Erreur</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.offer.title ?? "Offre"} — PartageCo` },
      {
        name: "description",
        content:
          "Détail d'une offre de co-abonnement. Simulation MVP — aucun paiement réel n'est exécuté.",
      },
    ],
  }),
});

const REASON_TOAST: Record<string, string> = {
  email_not_verified: "Vérifiez votre email pour rejoindre.",
  account_suspended: "Votre compte est suspendu.",
  account_deletion_requested: "Action indisponible.",
  offer_unavailable: "Cette offre n'est plus disponible.",
  offer_not_public: "Cette offre n'est plus disponible.",
  no_slots_available: "Plus aucune place disponible.",
  self_participation_forbidden: "Vous êtes propriétaire de cette offre.",
  participation_already_exists: "Demande déjà envoyée.",
  action_not_authorized: "Action non autorisée.",
  generic_error: "Une erreur est survenue.",
};

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function PublicOfferPage() {
  const { offer } = Route.useLoaderData();
  const { offerId } = Route.useParams();
  const { isAuthenticated, loading } = useAuth();
  const qc = useQueryClient();
  const fetchAvail = useServerFn(getOfferActionAvailability);
  const requestFn = useServerFn(requestParticipation);
  const [busy, setBusy] = useState(false);

  const availability = useQuery({
    queryKey: ["offer-availability", offerId],
    queryFn: () => fetchAvail({ data: { offerId } }),
    enabled: !loading && isAuthenticated,
  });

  const onRequest = async () => {
    if (!confirm("Confirmer la demande de participation ? Cette action sera journalisée.")) return;
    setBusy(true);
    try {
      await requestFn({ data: { offerId } });
      toast.success("Demande envoyée.");
      await qc.invalidateQueries({ queryKey: ["my-participations"] });
      await availability.refetch();
    } catch (e) {
      const code = e instanceof Error ? e.message : "generic_error";
      toast.error(REASON_TOAST[code] ?? code);
    } finally {
      setBusy(false);
    }
  };

  const visual = getServiceVisual(offer.service_slug);
  const noSlots = offer.available_slots <= 0;

  // CTA state derived from server-provided availability.
  // The server function getOfferActionAvailability is the single source of truth.
  function renderCta() {
    // State 1: Visitor not connected
    if (!loading && !isAuthenticated) {
      if (noSlots) {
        return (
          <Button disabled className="w-full sm:w-auto">
            Aucune place disponible
          </Button>
        );
      }
      return (
        <div className="flex flex-col items-center gap-2">
          <Link
            to="/signup"
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Créer un compte pour rejoindre
          </Link>
          <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
            Se connecter
          </Link>
        </div>
      );
    }

    if (availability.isLoading) {
      return <p className="text-sm text-muted-foreground">Vérification…</p>;
    }

    const data = availability.data;
    if (!data) return null;

    if (data.allowed) {
      // State 8: eligible verified user
      return (
        <Button onClick={onRequest} disabled={busy} className="w-full sm:w-auto">
          {busy ? "Envoi…" : "Demander à rejoindre"}
        </Button>
      );
    }

    const reason = data.reason ?? "generic_error";

    // State 5: Owner
    if (reason === "self_participation_forbidden") {
      return (
        <div className="flex flex-col items-center gap-2">
          <Button disabled className="w-full sm:w-auto">
            Vous êtes propriétaire de cette offre
          </Button>
          <Link
            to="/mes-offres/$offerId"
            params={{ offerId }}
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            Gérer mon offre
          </Link>
        </div>
      );
    }

    // State 6: already has active demand
    if (reason === "participation_already_exists") {
      return (
        <div className="flex flex-col items-center gap-2">
          <Button disabled className="w-full sm:w-auto">
            Demande déjà envoyée
          </Button>
          <Link to="/mes-participations" className="text-xs text-primary underline-offset-4 hover:underline">
            Voir mes participations
          </Link>
        </div>
      );
    }

    // State 2: not verified
    if (reason === "email_not_verified") {
      return (
        <Button disabled className="w-full sm:w-auto">
          Vérifiez votre email pour rejoindre
        </Button>
      );
    }

    // State 3: account suspended
    if (reason === "account_suspended") {
      return (
        <Button disabled className="w-full sm:w-auto">
          Compte suspendu
        </Button>
      );
    }

    // State 4: deletion requested
    if (reason === "account_deletion_requested") {
      return (
        <Button disabled className="w-full sm:w-auto">
          Action indisponible
        </Button>
      );
    }

    // State 7: no slots
    if (reason === "no_slots_available") {
      return (
        <Button disabled className="w-full sm:w-auto">
          Aucune place disponible
        </Button>
      );
    }

    // Other reasons (offer_unavailable, offer_not_public, action_not_authorized)
    return (
      <p className="text-sm text-muted-foreground">
        {REASON_TOAST[reason] ?? "Action non disponible."}
      </p>
    );
  }

  return (
    <div className="min-h-screen bg-background">

      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          to="/marketplace/service/$serviceSlug"
          params={{ serviceSlug: offer.service_slug ?? "" }}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          ← {offer.service_name ?? "Offres"}
        </Link>

        {/* Visual generated in Phase 14B — generic illustration, never an official logo. */}
        <div className="relative mt-6 mb-8 aspect-[16/9] w-full overflow-hidden rounded-xl border border-border bg-muted">
          {visual ? (
            <img
              src={visual}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="h-full w-full bg-gradient-to-br from-primary/30 via-primary/10 to-background"
            />
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 to-transparent p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {offer.service_name ?? "Service"}
              </span>
              {offer.plan_name && (
                <span className="rounded-full border border-border bg-background/80 px-2 py-0.5 text-xs font-medium text-foreground">
                  {offer.plan_name}
                </span>
              )}
              {offer.category_name && (
                <span className="text-xs text-muted-foreground">· {offer.category_name}</span>
              )}
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">{offer.title}</h1>

        <div
          role="note"
          className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
        >
          <strong className="font-medium text-foreground">
            Simulation MVP — aucun paiement réel n'est exécuté.
          </strong>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{NON_AFFILIATION_NOTICE}</p>

        {/* Owner trust card — primary reassurance */}
        <section className="mt-8 rounded-lg border border-border bg-card p-6">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Proposé par
          </h2>
          <div className="mt-3 flex items-center gap-4">
            <div
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary text-lg font-semibold text-primary-foreground"
            >
              {(offer.owner_display_name ?? "M")
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((s: string) => s[0]?.toUpperCase() ?? "")
                .join("") || "M"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-foreground">
                  {offer.owner_display_name ?? "Membre"}
                </p>
                {offer.owner_email_verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    ✓ Email vérifié
                  </span>
                )}
              </div>
              {offer.owner_member_since && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Membre depuis{" "}
                  {new Date(offer.owner_member_since).toLocaleDateString("fr-FR", {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
              {typeof offer.owner_active_offers_count === "number" && (
                <p className="text-xs text-muted-foreground">
                  {offer.owner_active_offers_count} offre
                  {offer.owner_active_offers_count > 1 ? "s" : ""} active
                  {offer.owner_active_offers_count > 1 ? "s" : ""} sur PartageCo
                </p>
              )}
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Les échanges se font via la messagerie interne après acceptation de votre demande. Aucun paiement réel n'est exécuté pendant la phase MVP.
          </p>
        </section>

        <section className="mt-6 rounded-lg border border-border p-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Montant indicatif mensuel</dt>
              <dd className="mt-1 text-lg font-medium">
                {formatAmount(Number(offer.monthly_price_amount), offer.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Places disponibles</dt>
              <dd className="mt-1 text-lg font-medium">{offer.available_slots}</dd>
            </div>
          </dl>
          {offer.description && (
            <div className="mt-6">
              <h2 className="text-sm font-medium">Description</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                {offer.description}
              </p>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-lg border border-dashed border-border p-6 text-center">
          {renderCta()}
        </section>
      </main>
    </div>
  );
}

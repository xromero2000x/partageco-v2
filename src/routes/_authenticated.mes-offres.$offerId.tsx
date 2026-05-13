import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getMyOffer,
  submitOffer,
  pauseOffer,
  archiveOffer,
} from "@/lib/offers.functions";
import {
  listOfferRequests,
  acceptParticipation,
  rejectParticipation,
} from "@/lib/participations.functions";
import { ensureParticipationConversation } from "@/lib/messages.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const PARTICIPATION_LABEL: Record<string, string> = {
  requested: "Demandée",
  accepted_pending_payment: "Acceptée — préparation en cours",
  active: "Active",
  cancelled: "Annulée",
  rejected: "Refusée",
  expired: "Expirée",
};

const ERROR_MAP: Record<string, string> = {
  forbidden: "Action non autorisée.",
  transition_forbidden: "Transition non autorisée.",
  not_found: "Demande introuvable.",
  no_slots_available: "Plus aucune place disponible.",
  offer_unavailable: "Offre indisponible.",
  email_not_verified: "Votre email n'est pas vérifié.",
  account_suspended: "Votre compte est suspendu.",
  account_deletion_requested: "Votre compte est en cours de suppression.",
  action_not_authorized: "Action non autorisée.",
  generic_error: "Une erreur est survenue.",
};

export const Route = createFileRoute("/_authenticated/mes-offres/$offerId")({
  component: ManageOfferPage,
  head: () => ({ meta: [{ title: "Gestion de l'offre — PartageCo" }] }),
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  pending_review: "En modération",
  active: "Active",
  paused: "En pause",
  rejected: "Rejetée",
  archived: "Archivée",
};

function ManageOfferPage() {
  const { offerId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchOffer = useServerFn(getMyOffer);
  const submit = useServerFn(submitOffer);
  const pause = useServerFn(pauseOffer);
  const archive = useServerFn(archiveOffer);
  const fetchRequests = useServerFn(listOfferRequests);
  const accept = useServerFn(acceptParticipation);
  const reject = useServerFn(rejectParticipation);
  const ensureConv = useServerFn(ensureParticipationConversation);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-offer", offerId],
    queryFn: () => fetchOffer({ data: { offerId } }),
  });
  const requestsQuery = useQuery({
    queryKey: ["offer-requests", offerId],
    queryFn: () => fetchRequests({ data: { offerId } }),
  });
  const [busy, setBusy] = useState(false);

  if (isLoading) return <p className="mx-auto max-w-3xl px-6 py-10 text-sm text-muted-foreground">Chargement…</p>;
  if (error) return <p role="alert" className="mx-auto max-w-3xl px-6 py-10 text-sm text-destructive">Impossible de charger cette offre.</p>;
  if (!data) return null;

  const o = data.offer;
  const status = o.offer_status as string;

  const run = async (label: string, action: () => Promise<unknown>) => {
    if (!confirm(`${label} ? Cette action sera journalisée.`)) return;
    setBusy(true);
    try {
      await action();
      toast.success("Action effectuée.");
      await qc.invalidateQueries({ queryKey: ["my-offers"] });
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link to="/mes-offres" className="text-sm text-muted-foreground hover:text-foreground">← Mes offres</Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{o.title}</h1>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
        {(o as { service_name?: string }).service_name ?? "Service"}
        {(o as { plan_name?: string }).plan_name ? (
          <> · <span className="text-foreground normal-case">{(o as { plan_name?: string }).plan_name}</span></>
        ) : (
          <> · <span className="italic normal-case">Gamme à compléter</span></>
        )}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Statut : {STATUS_LABEL[status] ?? status} · Visibilité : {o.visibility}
      </p>

      <section className="mt-6 rounded-lg border border-border p-6 text-sm">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">Places</dt><dd>{o.available_slots}/{o.total_slots}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Montant indicatif mensuel</dt><dd>{o.monthly_price_amount} {o.currency}</dd></div>
        </dl>
        {o.description && <p className="mt-4 whitespace-pre-line text-muted-foreground">{o.description}</p>}
      </section>

      {(status === "draft" || status === "rejected" || status === "paused") && (
        <p className="mt-6 text-sm">
          <Link
            to="/mes-offres/$offerId/edition"
            params={{ offerId }}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Modifier les informations de l'offre →
          </Link>
        </p>
      )}

      {status === "active" && (
        <p className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Cette offre doit être mise en pause avant modification.
        </p>
      )}

      <section className="mt-6 flex flex-wrap gap-3">
        {status === "draft" && (
          <Button disabled={busy} onClick={() => run("Soumettre en modération", () => submit({ data: { offerId } }))}>
            Soumettre en modération
          </Button>
        )}
        {status === "paused" && (
          <Button disabled={busy} onClick={() => run("Soumettre en modération", () => submit({ data: { offerId } }))}>
            Soumettre en modération
          </Button>
        )}
        {status === "active" && (
          <Button variant="outline" disabled={busy} onClick={() => run("Mettre en pause", () => pause({ data: { offerId } }))}>
            Mettre en pause
          </Button>
        )}
        {(status === "draft" || status === "paused" || status === "rejected") && (
          <Button variant="outline" disabled={busy} onClick={() => run("Archiver", async () => { await archive({ data: { offerId } }); navigate({ to: "/mes-offres" }); })}>
            Archiver
          </Button>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Demandes de participation</h2>
        {requestsQuery.isLoading && (
          <p className="mt-3 text-sm text-muted-foreground">Chargement…</p>
        )}
        {requestsQuery.error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            Impossible de charger les demandes.
          </p>
        )}
        {requestsQuery.data && requestsQuery.data.requests.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Aucune demande pour l'instant.
          </p>
        )}
        {requestsQuery.data && requestsQuery.data.requests.length > 0 && (
          <ul className="mt-3 space-y-3">
            {requestsQuery.data.requests.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-4 text-sm"
              >
                <div>
                  <div className="font-medium">
                    {r.subscriber_display_name ?? "Co-abonné"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Statut : {PARTICIPATION_LABEL[r.participation_status] ?? r.participation_status}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Demandée le{" "}
                    {new Date(r.requested_at).toLocaleDateString("fr-FR")}
                    {r.accepted_at &&
                      ` · acceptée le ${new Date(r.accepted_at).toLocaleDateString("fr-FR")}`}
                    {r.cancelled_at &&
                      ` · annulée le ${new Date(r.cancelled_at).toLocaleDateString("fr-FR")}`}
                  </div>
                </div>
                {r.participation_status === "requested" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={async () => {
                        if (!confirm("Accepter cette demande ? Cette action sera journalisée.")) return;
                        setBusy(true);
                        try {
                          await accept({ data: { coSubId: r.id } });
                          toast.success("Demande acceptée.");
                          await requestsQuery.refetch();
                          await refetch();
                        } catch (e) {
                          const code = e instanceof Error ? e.message : "generic_error";
                          toast.error(ERROR_MAP[code] ?? code);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Accepter
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={async () => {
                        if (!confirm("Rejeter cette demande ? Cette action sera journalisée.")) return;
                        setBusy(true);
                        try {
                          await reject({ data: { coSubId: r.id } });
                          toast.success("Demande rejetée.");
                          await requestsQuery.refetch();
                          await refetch();
                        } catch (e) {
                          const code = e instanceof Error ? e.message : "generic_error";
                          toast.error(ERROR_MAP[code] ?? code);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Rejeter
                    </Button>
                  </div>
                )}
                {(r.participation_status === "accepted_pending_payment" ||
                  r.participation_status === "active") && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const res = await ensureConv({
                          data: { co_subscription_id: r.id },
                        });
                        navigate({
                          to: "/messages/$conversationId",
                          params: { conversationId: res.conversation_id },
                        });
                      } catch (e) {
                        const code = e instanceof Error ? e.message : "generic_error";
                        toast.error(ERROR_MAP[code] ?? "Une erreur est survenue.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Ouvrir la messagerie
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getMyParticipation,
  cancelParticipation,
} from "@/lib/participations.functions";
import { ensureParticipationConversation } from "@/lib/messages.functions";
import { startPaymentCheckout } from "@/lib/payments.functions";
import { LeaveReviewSection } from "@/components/reviews/LeaveReviewSection";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/mes-participations/$coSubId")({
  component: ParticipationDetailPage,
  head: () => ({ meta: [{ title: "Détail participation — PartageCo" }] }),
});

const STATUS_LABEL: Record<string, string> = {
  requested: "Demandée",
  accepted_pending_payment: "Acceptée",
  active: "Active",
  cancelled: "Annulée",
  rejected: "Refusée",
  expired: "Expirée",
};

function fmtDate(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const ERROR_MAP: Record<string, string> = {
  forbidden: "Action non autorisée.",
  transition_forbidden: "Transition non autorisée.",
  not_found: "Participation introuvable.",
  email_not_verified: "Votre email n'est pas vérifié.",
  account_suspended: "Votre compte est suspendu.",
  account_deletion_requested: "Votre compte est en cours de suppression.",
  action_not_authorized: "Action non autorisée.",
  payment_provider_not_configured: "Provider de paiement non configuré.",
  payment_provider_unknown: "Provider de paiement inconnu.",
  invalid_amount: "Montant invalide.",
  invalid_currency: "Devise non supportée.",
  generic_error: "Une erreur est survenue.",
};

function ParticipationDetailPage() {
  const { coSubId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { appUser } = useAuth();
  const fetchOne = useServerFn(getMyParticipation);
  const cancel = useServerFn(cancelParticipation);
  const ensureConv = useServerFn(ensureParticipationConversation);
  const startCheckout = useServerFn(startPaymentCheckout);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["participation", coSubId],
    queryFn: () => fetchOne({ data: { coSubId } }),
  });

  if (isLoading)
    return <p className="mx-auto max-w-3xl px-6 py-10 text-sm text-muted-foreground">Chargement…</p>;
  if (error)
    return (
      <p role="alert" className="mx-auto max-w-3xl px-6 py-10 text-sm text-destructive">
        Impossible de charger cette participation.
      </p>
    );
  if (!data) return null;

  const cs = data.participation;
  const offer = cs.offer as {
    id: string;
    title: string;
    description: string | null;
    currency: string;
    monthly_price_amount: number;
    service_name?: string | null;
    plan_name?: string | null;
  } | null;
  const payment = data.payment as {
    id: string;
    gross_amount: number;
    currency: string;
    payment_status: string;
    created_at?: string;
  } | null;

  const status = cs.participation_status as string;
  const canCancel = status === "requested" || status === "accepted_pending_payment" || status === "active";

  const onCancel = async () => {
    const msg =
      status === "active"
        ? "Mettre fin à cette participation active ? Vous perdrez l'accès à l'offre partagée. Cette action est irréversible et sera journalisée."
        : "Annuler cette demande de participation ? Cette action sera journalisée.";
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      await cancel({ data: { coSubId } });
      toast.success("Participation annulée.");
      await qc.invalidateQueries({ queryKey: ["my-participations"] });
      await refetch();
    } catch (e) {
      const code = e instanceof Error ? e.message : "generic_error";
      toast.error(ERROR_MAP[code] ?? code);
    } finally {
      setBusy(false);
    }
  };

  const onStartCheckout = async () => {
    if (!payment) return;
    setBusy(true);
    try {
      const res = await startCheckout({ data: { paymentRecordId: payment.id } });
      if (res.mode === "simulation") {
        toast.info(
          "Paiement réel non encore activé. Un administrateur peut valider ce paiement en mode test.",
          { duration: 6000 }
        );
      } else if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    } catch (e) {
      const code = e instanceof Error ? e.message : "generic_error";
      toast.error(ERROR_MAP[code] ?? code);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        to="/mes-participations"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Mes participations
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{offer?.title ?? "Participation"}</h1>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
        {offer?.service_name ?? "Service"}
        {offer?.plan_name && (
          <> · <span className="text-foreground normal-case">{offer.plan_name}</span></>
        )}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Statut : {STATUS_LABEL[status] ?? status}
      </p>

      <section className="mt-6 rounded-lg border border-border p-6 text-sm">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Demandée le</dt>
            <dd>{fmtDate(cs.requested_at)}</dd>
          </div>
          {cs.accepted_at && (
            <div>
              <dt className="text-xs text-muted-foreground">Acceptée le</dt>
              <dd>{fmtDate(cs.accepted_at)}</dd>
            </div>
          )}
          {cs.cancelled_at && (
            <div>
              <dt className="text-xs text-muted-foreground">Annulée le</dt>
              <dd>{fmtDate(cs.cancelled_at)}</dd>
            </div>
          )}
          {cs.ended_at && (
            <div>
              <dt className="text-xs text-muted-foreground">Terminée le</dt>
              <dd>{fmtDate(cs.ended_at)}</dd>
            </div>
          )}
          {offer && (
            <div>
              <dt className="text-xs text-muted-foreground">Montant indicatif mensuel</dt>
              <dd>
                {Number(offer.monthly_price_amount).toLocaleString("fr-FR", {
                  style: "currency",
                  currency: offer.currency,
                })}
              </dd>
            </div>
          )}
        </dl>
        {offer?.description && (
          <p className="mt-4 whitespace-pre-line text-muted-foreground">{offer.description}</p>
        )}
      </section>

      {payment && (
        <section className="mt-6 rounded-lg border border-border bg-muted/30 p-6 text-sm">
          <h2 className="text-sm font-medium">Paiement préparatoire</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Montant indicatif</dt>
              <dd>
                {Number(payment.gross_amount).toLocaleString("fr-FR", {
                  style: "currency",
                  currency: payment.currency,
                })}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Statut</dt>
              <dd>
                {(
                  {
                    pending: "En attente de validation",
                    simulated: "Validé en mode test",
                    cancelled: "Annulé",
                    failed: "Échec simulé",
                  } as Record<string, string>
                )[payment.payment_status] ?? payment.payment_status}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Créé le</dt>
              <dd>{fmtDate(payment.created_at ?? null)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs italic text-muted-foreground">
            Simulation MVP — aucun paiement réel n'est exécuté.
          </p>
        </section>
      )}

      {status === "accepted_pending_payment" && (
        <div
          role="note"
          className="mt-6 rounded-md border border-border bg-muted/40 px-4 py-4 text-sm"
        >
          <p className="font-medium text-foreground">Votre demande a été acceptée.</p>
          <p className="mt-1 text-muted-foreground">
            Le paiement doit être validé avant l'activation de la participation. La messagerie sera disponible une fois la participation active.
          </p>
          {payment && payment.payment_status === "pending" && (
            <Button
              className="mt-4"
              disabled={busy}
              onClick={onStartCheckout}
            >
              Continuer vers le paiement
            </Button>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {status === "active" && (
          <Button
            variant="default"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await ensureConv({ data: { co_subscription_id: coSubId } });
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
        {canCancel && (
          <Button variant="outline" disabled={busy} onClick={onCancel}>
            {status === "active" ? "Mettre fin à la participation" : "Annuler la participation"}
          </Button>
        )}
        <Button variant="ghost" onClick={() => navigate({ to: "/mes-participations" })}>
          Retour
        </Button>
      </div>
    </div>
  );
}

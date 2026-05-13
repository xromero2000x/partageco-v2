import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getAdminDeletionRequest,
  transitionDeletionRequest,
} from "@/lib/deletion.functions";

export const Route = createFileRoute(
  "/_authenticated/admin/suppressions/$deletionRequestId",
)({
  component: AdminDeletionDetailPage,
  head: () => ({ meta: [{ title: "Demande de suppression — Admin" }] }),
});

function AdminDeletionDetailPage() {
  const { deletionRequestId } = Route.useParams();
  const fetchOne = useServerFn(getAdminDeletionRequest);
  const transition = useServerFn(transitionDeletionRequest);
  const navigate = useNavigate();
  const [data, setData] = useState<
    Awaited<ReturnType<typeof getAdminDeletionRequest>> | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [justification, setJustification] = useState("");
  const [completeConfirm, setCompleteConfirm] = useState(false);

  const reload = useCallback(async () => {
    try {
      const r = await fetchOne({ data: { deletion_request_id: deletionRequestId } });
      setData(r);
    } catch (e) {
      const m = (e as Error).message ?? "";
      setError(
        m.includes("forbidden")
          ? "Accès réservé aux super administrateurs."
          : "Erreur de chargement.",
      );
    } finally {
      setLoading(false);
    }
  }, [fetchOne, deletionRequestId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const act = async (
    action: "take_under_review" | "reject" | "complete",
    extra?: { justification?: string },
  ) => {
    setBusy(true);
    try {
      await transition({
        data: {
          deletion_request_id: deletionRequestId,
          action,
          justification: extra?.justification,
        },
      });
      toast.success("Action effectuée. Cette action sera journalisée.");
      setRejectMode(false);
      setJustification("");
      setCompleteConfirm(false);
      await reload();
    } catch (e) {
      const m = (e as Error).message ?? "";
      if (m.includes("transition_forbidden")) {
        toast.error("Transition non autorisée.");
      } else if (m.includes("justification_required")) {
        toast.error("Justification requise (20 à 1000 caractères).");
      } else if (m.includes("complete_aborted_offers_pause_failed")) {
        toast.error("Complétion annulée : la pause des offres a échoué.");
      } else if (m.includes("complete_aborted_auth_invalidation_failed")) {
        toast.error("Complétion annulée : l'invalidation de l'accès a échoué. Réessayez.");
      } else if (m.includes("forbidden")) {
        toast.error("Accès refusé.");
      } else {
        toast.error("Une erreur est survenue.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  if (error) return <div className="p-6 text-sm text-destructive">{error}</div>;
  if (!data) return null;

  const r = data.request;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link to="/admin/suppressions" className="text-sm text-primary hover:underline">
        ← Retour
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Demande de suppression
      </h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Consultation administrative journalisée.
      </p>

      <section className="mt-6 space-y-2 rounded-lg border border-border bg-card p-5 text-sm">
        <Row label="Utilisateur" value={data.display_name} />
        <Row label="user_id" value={r.user_id} />
        <Row label="Statut compte" value={data.user?.account_status ?? "—"} />
        <Row label="Statut demande" value={r.request_status} />
        <Row label="Motif" value={r.reason ?? "—"} />
        <Row label="Demandée le" value={new Date(r.requested_at).toLocaleString()} />
        <Row
          label="Traitée le"
          value={r.processed_at ? new Date(r.processed_at).toLocaleString() : "—"}
        />
        <Row
          label="Traitée par"
          value={r.processed_by_admin_user_id ?? "—"}
        />
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold">Actions</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Cette action sera journalisée.
        </p>

        {r.request_status === "requested" && (
          <div className="mt-3">
            <Button onClick={() => void act("take_under_review")} disabled={busy}>
              Passer en revue
            </Button>
          </div>
        )}

        {r.request_status === "under_review" && (
          <div className="mt-3 space-y-4">
            {!rejectMode && !completeConfirm && (
              <div className="flex gap-2">
                <Button onClick={() => setRejectMode(true)} variant="outline" disabled={busy}>
                  Rejeter
                </Button>
                <Button
                  onClick={() => setCompleteConfirm(true)}
                  variant="destructive"
                  disabled={busy}
                >
                  Compléter
                </Button>
              </div>
            )}

            {rejectMode && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Justification interne (20 à 1000 caractères, non exposée à l'utilisateur)
                </label>
                <Textarea
                  rows={5}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value.slice(0, 1000))}
                />
                <div className="text-xs text-muted-foreground">
                  {justification.trim().length} / 1000
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => void act("reject", { justification: justification.trim() })}
                    disabled={busy || justification.trim().length < 20}
                    variant="destructive"
                  >
                    Confirmer le rejet
                  </Button>
                  <Button
                    onClick={() => {
                      setRejectMode(false);
                      setJustification("");
                    }}
                    variant="ghost"
                    disabled={busy}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            )}

            {completeConfirm && (
              <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <p className="text-sm">
                  Confirmer la complétion : email anonymisé, mot de passe invalidé,
                  offres actives mises en pause. Les registres protégés sont conservés.
                  Cette action sera journalisée.
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => void act("complete")}
                    disabled={busy}
                    variant="destructive"
                  >
                    Confirmer la complétion
                  </Button>
                  <Button
                    onClick={() => setCompleteConfirm(false)}
                    variant="ghost"
                    disabled={busy}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {(r.request_status === "rejected" || r.request_status === "completed") && (
          <p className="mt-3 text-sm text-muted-foreground">
            Cette demande est clôturée.{" "}
            <button
              onClick={() => navigate({ to: "/admin/suppressions" })}
              className="text-primary hover:underline"
            >
              Retour à la liste
            </button>
            .
          </p>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right break-all">{value}</span>
    </div>
  );
}

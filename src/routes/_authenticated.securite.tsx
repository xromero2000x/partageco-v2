import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getMyDeletionState,
  requestAccountDeletion,
} from "@/lib/deletion.functions";

export const Route = createFileRoute("/_authenticated/securite")({
  component: SecuritePage,
  head: () => ({ meta: [{ title: "Sécurité — PartageCo" }] }),
});

function SecuritePage() {
  const fetchState = useServerFn(getMyDeletionState);
  const requestFn = useServerFn(requestAccountDeletion);
  const [state, setState] = useState<Awaited<ReturnType<typeof getMyDeletionState>> | null>(null);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reload = async () => {
    try {
      const s = await fetchState();
      setState(s);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    setSubmitting(true);
    try {
      await requestFn({ data: { reason: reason.trim() || undefined } });
      toast.success("Votre demande de suppression est en cours de traitement.");
      setConfirming(false);
      setReason("");
      await reload();
    } catch (e) {
      const msg = (e as Error).message ?? "internal_error";
      if (msg.includes("deletion_request_duplicate")) {
        toast.error("Une demande de suppression est déjà en cours.");
      } else if (msg.includes("transition_forbidden")) {
        toast.error("Action non autorisée pour le statut de votre compte.");
      } else {
        toast.error("Une erreur est survenue.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const hasOpenRequest =
    state?.latest_request &&
    (state.latest_request.request_status === "requested" ||
      state.latest_request.request_status === "under_review");
  const isDeletionRequested = state?.account_status === "deletion_requested";

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Sécurité du compte</h1>

      <section className="mt-6 rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold">Vérification email</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {state?.email_verified
            ? "Votre adresse email est vérifiée."
            : "Votre adresse email n'est pas encore vérifiée."}
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold">Suppression du compte</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La suppression n'est pas immédiate et sera revue par un administrateur.
          Le processus comprend : votre demande, une revue par un administrateur,
          un rejet possible, ou une complétion. Certains registres peuvent être
          conservés conformément aux obligations de sécurité et de traçabilité.
        </p>

        {isDeletionRequested || hasOpenRequest ? (
          <div className="mt-4 rounded-md border border-border bg-muted/40 p-4 text-sm">
            Votre demande de suppression est en cours de traitement.
          </div>
        ) : !confirming ? (
          <div className="mt-4">
            <Button onClick={() => setConfirming(true)} variant="destructive">
              Demander la suppression de mon compte
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm">
              Confirmez votre demande. Cette action sera journalisée. La
              suppression n'est pas immédiate et sera revue par un administrateur.
            </p>
            <div>
              <label className="text-sm font-medium">Motif (facultatif)</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 1000))}
                rows={4}
                placeholder="Indiquez un motif si vous le souhaitez."
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void submit()} disabled={submitting} variant="destructive">
                Confirmer la demande
              </Button>
              <Button
                onClick={() => {
                  setConfirming(false);
                  setReason("");
                }}
                variant="ghost"
                disabled={submitting}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

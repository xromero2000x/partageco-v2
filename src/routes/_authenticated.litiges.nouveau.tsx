import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  createDispute,
  listEligibleParticipations,
} from "@/lib/disputes.functions";

export const Route = createFileRoute("/_authenticated/litiges/nouveau")({
  component: NouveauLitigePage,
  head: () => ({ meta: [{ title: "Nouveau litige" }] }),
});

const REASONS: Array<{ value: string; label: string }> = [
  { value: "access_issue", label: "Problème d'accès" },
  { value: "payment_issue", label: "Problème de paiement" },
  { value: "communication_issue", label: "Problème de communication" },
  { value: "offer_mismatch", label: "Offre non conforme" },
  { value: "other", label: "Autre" },
];

function NouveauLitigePage() {
  const navigate = useNavigate();
  const listFn = useServerFn(listEligibleParticipations);
  const createFn = useServerFn(createDispute);
  const { data, isLoading } = useQuery({
    queryKey: ["eligible-participations"],
    queryFn: () => listFn(),
  });

  const [coSubId, setCoSubId] = useState("");
  const [reason, setReason] = useState("access_issue");
  const [description, setDescription] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          co_subscription_id: coSubId,
          dispute_reason: reason as
            | "access_issue"
            | "payment_issue"
            | "communication_issue"
            | "offer_mismatch"
            | "other",
          description: description.trim() ? description.trim() : null,
        },
      }),
    onSuccess: (r) => {
      toast.success("Litige ouvert.");
      navigate({ to: "/litiges/$disputeId", params: { disputeId: r.id } });
    },
    onError: (e) => toast.error((e as Error).message ?? "Erreur"),
  });

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <Link to="/litiges" className="text-sm text-muted-foreground hover:underline">
        ← Litiges
      </Link>
      <h1 className="mt-3 text-xl font-semibold">Ouvrir un litige</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        Aucune décision financière automatique ne sera prise dans le MVP.
      </p>

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Chargement…</p>
      ) : !data?.participations.length ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Aucune participation éligible à un litige.
        </p>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!coSubId) {
              toast.error("Sélectionnez une participation.");
              return;
            }
            mut.mutate();
          }}
        >
          <div>
            <Label htmlFor="cs">Participation concernée</Label>
            <select
              id="cs"
              value={coSubId}
              onChange={(e) => setCoSubId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              required
            >
              <option value="">— Sélectionner —</option>
              {data.participations.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.offer_title} ({p.role}, {p.participation_status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="reason">Motif</Label>
            <select
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="desc">Description (optionnelle)</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder="Décrivez la situation."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Link to="/litiges">
              <Button type="button" variant="ghost">
                Annuler
              </Button>
            </Link>
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending ? "Ouverture…" : "Ouvrir le litige"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

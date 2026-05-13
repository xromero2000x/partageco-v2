import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminViewDisputeConversation,
  getAdminDispute,
  reassignDispute,
  takeChargeDispute,
  transitionDispute,
} from "@/lib/disputes.functions";

export const Route = createFileRoute("/_authenticated/admin/litiges/$disputeId")({
  component: AdminDisputeDetailPage,
  head: () => ({ meta: [{ title: "Admin — Litige" }] }),
});

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR");
  } catch {
    return iso;
  }
}

function AdminDisputeDetailPage() {
  const { disputeId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getAdminDispute);
  const takeFn = useServerFn(takeChargeDispute);
  const transFn = useServerFn(transitionDispute);
  const reassignFn = useServerFn(reassignDispute);
  const viewFn = useServerFn(adminViewDisputeConversation);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-dispute", disputeId],
    queryFn: () => getFn({ data: { dispute_id: disputeId } }),
    retry: false,
  });

  const [convData, setConvData] = useState<Awaited<ReturnType<typeof viewFn>> | null>(null);
  const [newAdminId, setNewAdminId] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-dispute", disputeId] });

  const takeMut = useMutation({
    mutationFn: () => takeFn({ data: { dispute_id: disputeId } }),
    onSuccess: () => {
      toast.success("Litige pris en charge.");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message ?? "Erreur"),
  });

  const transMut = useMutation({
    mutationFn: (target: "waiting_user_response" | "under_review" | "resolved" | "closed") =>
      transFn({ data: { dispute_id: disputeId, target_status: target } }),
    onSuccess: () => {
      toast.success("Statut mis à jour.");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message ?? "Erreur"),
  });

  const reassignMut = useMutation({
    mutationFn: () =>
      reassignFn({
        data: { dispute_id: disputeId, new_admin_user_id: newAdminId },
      }),
    onSuccess: () => {
      toast.success("Litige réassigné.");
      setNewAdminId("");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message ?? "Erreur"),
  });

  const viewMut = useMutation({
    mutationFn: () => viewFn({ data: { dispute_id: disputeId } }),
    onSuccess: (d) => setConvData(d),
    onError: (e) => toast.error((e as Error).message ?? "Erreur"),
  });

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-6 py-8 text-sm text-muted-foreground">Chargement…</div>;
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <p className="text-sm text-destructive">Accès refusé ou introuvable.</p>
        <Button
          variant="ghost"
          className="mt-3"
          onClick={() => navigate({ to: "/admin/litiges" })}
        >
          ← Retour
        </Button>
      </div>
    );
  }

  const d = data.dispute;
  const perms = data.perms;

  const ask = (msg: string) => confirm(`${msg}\nCette action sera journalisée.`);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link to="/admin/litiges" className="text-sm text-muted-foreground hover:underline">
        ← Litiges
      </Link>
      <h1 className="mt-3 text-xl font-semibold">{data.offer_title}</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Aucune décision financière automatique ne sera prise dans le MVP.
      </p>

      <div className="mt-4 rounded-lg border border-border bg-card p-4">
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Statut</dt>
          <dd>{d.dispute_status}</dd>
          <dt className="text-muted-foreground">Motif</dt>
          <dd>{d.dispute_reason}</dd>
          <dt className="text-muted-foreground">Assigné à</dt>
          <dd>{d.assigned_admin_user_id ?? "—"}</dd>
          <dt className="text-muted-foreground">Créé le</dt>
          <dd>{fmt(d.created_at)}</dd>
          <dt className="text-muted-foreground">Clôturé le</dt>
          <dd>{fmt(d.closed_at)}</dd>
        </dl>
        {d.description && (
          <div className="mt-3 whitespace-pre-wrap text-sm">
            <div className="text-xs uppercase text-muted-foreground">Description</div>
            <p className="mt-1">{d.description}</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {perms.can_take_charge && (
          <Button
            size="sm"
            onClick={() => {
              if (ask("Prendre en charge ce litige ?")) takeMut.mutate();
            }}
          >
            Prendre en charge
          </Button>
        )}
        {d.dispute_status === "under_review" && perms.can_act_assigned && (
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (ask("Demander une réponse utilisateur ?"))
                  transMut.mutate("waiting_user_response");
              }}
            >
              Demander réponse
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (ask("Marquer comme résolu ?")) transMut.mutate("resolved");
              }}
            >
              Résoudre
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (ask("Clôturer ce litige ?")) transMut.mutate("closed");
              }}
            >
              Clôturer
            </Button>
          </>
        )}
        {d.dispute_status === "waiting_user_response" && perms.can_act_assigned && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (ask("Repasser en revue ?")) transMut.mutate("under_review");
            }}
          >
            Repasser en revue
          </Button>
        )}
        {d.dispute_status === "resolved" && perms.can_act_assigned && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              if (ask("Clôturer ce litige ?")) transMut.mutate("closed");
            }}
          >
            Clôturer
          </Button>
        )}
      </div>

      {perms.can_reassign && (
        <div className="mt-6 rounded-lg border border-border bg-card p-4">
          <div className="text-sm font-medium">Réassigner (super_admin)</div>
          <div className="mt-2 flex gap-2">
            <Input
              placeholder="UUID du nouvel admin"
              value={newAdminId}
              onChange={(e) => setNewAdminId(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!newAdminId || reassignMut.isPending}
              onClick={() => {
                if (ask("Réassigner ce litige ?")) reassignMut.mutate();
              }}
            >
              Réassigner
            </Button>
          </div>
        </div>
      )}

      {perms.can_view_conversation && (
        <div className="mt-6 rounded-lg border border-border bg-card p-4">
          <div className="text-sm font-medium">Conversation du litige</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Consultation administrative journalisée.
          </p>
          <Button
            size="sm"
            className="mt-3"
            onClick={() => {
              if (ask("Consulter la conversation ?")) viewMut.mutate();
            }}
          >
            Consulter
          </Button>
          {convData && (
            <ul className="mt-4 space-y-2">
              {convData.messages.map((m) => (
                <li key={m.id} className="rounded border border-border p-2 text-sm">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{m.sender_name}</span>
                    <span>{fmt(m.created_at)}</span>
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">
                    {m.message_status === "sent" && m.body}
                    {m.message_status === "deleted_by_user" && (
                      <span className="italic text-muted-foreground">
                        Message supprimé par son auteur.
                      </span>
                    )}
                    {m.message_status === "hidden_by_admin" && (
                      <span className="italic text-muted-foreground">
                        Message masqué par modération.
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyDispute } from "@/lib/disputes.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/litiges/$disputeId")({
  component: DisputeDetailPage,
  head: () => ({ meta: [{ title: "Litige" }] }),
});

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR");
  } catch {
    return iso;
  }
}

function DisputeDetailPage() {
  const { disputeId } = Route.useParams();
  const fn = useServerFn(getMyDispute);
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-dispute", disputeId],
    queryFn: () => fn({ data: { dispute_id: disputeId } }),
    retry: false,
  });

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-6 py-8 text-sm text-muted-foreground">Chargement…</div>;
  }
  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <p className="text-sm text-destructive">Une erreur est survenue.</p>
        <Link to="/litiges">
          <Button variant="ghost" className="mt-3">
            ← Retour
          </Button>
        </Link>
      </div>
    );
  }
  if (!data) return null;

  const d = data.dispute;
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link to="/litiges" className="text-sm text-muted-foreground hover:underline">
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

      <div className="mt-6 rounded-lg border border-border bg-card p-4">
        <div className="text-sm font-medium">Conversation du litige</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Échangez avec l'autre partie et l'équipe support assignée.
        </p>
        {data.conversation_id ? (
          <Link
            to="/messages/$conversationId"
            params={{ conversationId: data.conversation_id }}
          >
            <Button size="sm" className="mt-3">
              Ouvrir la conversation
            </Button>
          </Link>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Conversation indisponible.
          </p>
        )}
      </div>
    </div>
  );
}

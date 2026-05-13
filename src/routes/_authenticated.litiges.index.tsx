import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyDisputes } from "@/lib/disputes.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/litiges/")({
  component: LitigesIndex,
  head: () => ({ meta: [{ title: "Litiges" }] }),
});

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-FR");
  } catch {
    return iso;
  }
}

function LitigesIndex() {
  const fn = useServerFn(listMyDisputes);
  const { data, isLoading } = useQuery({
    queryKey: ["my-disputes"],
    queryFn: () => fn(),
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Litiges</h1>
        <Link to="/litiges/nouveau">
          <Button size="sm">Ouvrir un litige</Button>
        </Link>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Aucune décision financière automatique ne sera prise dans le MVP.
      </p>

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Chargement…</p>
      ) : !data?.disputes.length ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Vous n'avez aucun litige en cours.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {data.disputes.map((d) => (
            <li key={d.id}>
              <Link
                to="/litiges/$disputeId"
                params={{ disputeId: d.id }}
                className="block rounded-lg border border-border bg-card p-4 hover:bg-accent"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{d.offer_title}</div>
                    <div className="text-xs text-muted-foreground">
                      Motif : {d.dispute_reason} · Statut : {d.dispute_status}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{fmt(d.created_at)}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

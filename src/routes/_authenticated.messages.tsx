import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyConversations } from "@/lib/messages.functions";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesListPage,
  head: () => ({ meta: [{ title: "Messages — PartageCo" }] }),
});

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function MessagesListPage() {
  const fn = useServerFn(listMyConversations);
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-conversations"],
    queryFn: () => fn({}),
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Messages</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Conversations liées à vos offres et participations.
      </p>

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Chargement…</p>}
      {error && (
        <p className="mt-6 text-sm text-destructive">Une erreur est survenue.</p>
      )}

      {data && data.conversations.length === 0 && (
        <div className="mt-8 rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Vous n'avez aucune conversation.
        </div>
      )}

      {data && data.conversations.length > 0 && (
        <ul className="mt-6 space-y-3">
          {data.conversations.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-border bg-card p-4 hover:bg-accent/40"
            >
              <Link
                to="/messages/$conversationId"
                params={{ conversationId: c.id }}
                className="block"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {c.conversation_type === "participation_context" && "Contexte participation"}
                    {c.conversation_type === "dispute_context" && "Contexte litige"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {fmtDate(c.last_message_at)}
                  </span>
                </div>
                <div className="mt-1 text-sm font-medium">{c.offer_title}</div>
                <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {c.last_preview}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

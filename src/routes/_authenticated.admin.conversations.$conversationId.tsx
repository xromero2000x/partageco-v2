import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  adminViewConversation,
  hideMessageByAdmin,
} from "@/lib/messages.functions";

export const Route = createFileRoute("/_authenticated/admin/conversations/$conversationId")({
  component: AdminConversationDetailPage,
  head: () => ({ meta: [{ title: "Admin — Conversation" }] }),
});

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-FR");
  } catch {
    return iso;
  }
}

function AdminConversationDetailPage() {
  const { conversationId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const viewFn = useServerFn(adminViewConversation);
  const hideFn = useServerFn(hideMessageByAdmin);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-conversation", conversationId],
    queryFn: () => viewFn({ data: { conversation_id: conversationId } }),
    retry: false,
  });

  const hideMut = useMutation({
    mutationFn: (message_id: string) => hideFn({ data: { message_id } }),
    onSuccess: async () => {
      toast.success("Message masqué.");
      await qc.invalidateQueries({ queryKey: ["admin-conversation", conversationId] });
    },
    onError: (e) => toast.error((e as Error).message ?? "Erreur"),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8 text-sm text-muted-foreground">
        Chargement…
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <p className="text-sm text-destructive">
          {(error as Error).message === "forbidden"
            ? "Accès réservé aux administrateurs."
            : "Une erreur est survenue."}
        </p>
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() => navigate({ to: "/admin/conversations" })}
        >
          ← Retour
        </Button>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        to="/admin/conversations"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Toutes les conversations
      </Link>

      <div
        role="status"
        className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200"
      >
        Consultation administrative journalisée.
      </div>

      <div className="mt-4 rounded-lg border border-border bg-card p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {data.conversation.conversation_type}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Conversation #{data.conversation.id}
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          Participants :{" "}
          {data.participants
            .map((p) => `${p.display_name} (${p.participant_role}${p.left_at ? ", parti" : ""})`)
            .join(", ")}
        </div>
      </div>

      <ul className="mt-6 space-y-3">
        {data.messages.map((m) => (
          <li key={m.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{m.sender_name}</span>
              <span>{fmt(m.created_at)}</span>
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm">
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
            {m.message_status === "sent" && data.can_moderate && (
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Masquer ce message ? L'action sera journalisée."))
                      hideMut.mutate(m.id);
                  }}
                  className="text-xs text-destructive hover:underline"
                >
                  Masquer
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

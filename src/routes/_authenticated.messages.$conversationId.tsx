import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getConversation,
  sendMessage,
  deleteMyMessage,
} from "@/lib/messages.functions";

export const Route = createFileRoute("/_authenticated/messages/$conversationId")({
  component: ConversationPage,
  head: () => ({ meta: [{ title: "Conversation — PartageCo" }] }),
});

const ERROR_MAP: Record<string, string> = {
  forbidden: "Action non autorisée.",
  not_found: "Conversation introuvable.",
  email_not_verified: "Votre email n'est pas vérifié.",
  account_suspended: "Votre compte est suspendu.",
  account_deletion_requested: "Votre compte est en cours de suppression.",
  action_not_authorized: "Action non autorisée.",
  empty_body: "Le message ne peut pas être vide.",
  too_long: "Le message est trop long.",
  send_failed: "L'envoi a échoué.",
  transition_forbidden: "Action non autorisée sur ce message.",
  update_failed: "Mise à jour impossible.",
};

function fmtTime(iso: string) {
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

function mapErr(e: unknown) {
  const m = e instanceof Error ? e.message : "generic_error";
  return ERROR_MAP[m] ?? "Une erreur est survenue.";
}

function ConversationPage() {
  const { conversationId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getConversation);
  const sendFn = useServerFn(sendMessage);
  const delFn = useServerFn(deleteMyMessage);

  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => getFn({ data: { conversation_id: conversationId } }),
    retry: false,
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
        <p className="text-sm text-destructive">{mapErr(error)}</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate({ to: "/messages" })}>
          ← Retour aux messages
        </Button>
      </div>
    );
  }
  if (!data) return null;

  const { conversation, participants, messages } = data;

  const onSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await sendFn({ data: { conversation_id: conversationId, body } });
      setBody("");
      await qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
      await qc.invalidateQueries({ queryKey: ["my-conversations"] });
    } catch (e) {
      toast.error(mapErr(e));
    } finally {
      setSending(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Supprimer ce message ?")) return;
    try {
      await delFn({ data: { message_id: id } });
      await qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
    } catch (e) {
      toast.error(mapErr(e));
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        to="/messages"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Tous les messages
      </Link>

      <div className="mt-4 rounded-lg border border-border bg-card p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {conversation.conversation_type === "offer_context" && "Contexte offre"}
          {conversation.conversation_type === "participation_context" && "Contexte participation"}
          {conversation.conversation_type === "dispute_context" && "Contexte litige"}
        </div>
        <h1 className="mt-1 text-lg font-semibold">
          {conversation.context_label ?? "Conversation"}
        </h1>
        {conversation.offer_id && (
          <Link
            to="/offres/$offerId"
            params={{ offerId: conversation.offer_id }}
            className="mt-1 inline-block text-sm text-primary hover:underline"
          >
            Voir l'offre liée
          </Link>
        )}
        <div className="mt-3 text-xs text-muted-foreground">
          Participants :{" "}
          {participants
            .filter((p) => p.left_at === null)
            .map((p) => p.display_name)
            .join(", ")}
        </div>
      </div>

      <ul className="mt-6 space-y-3">
        {messages.length === 0 && (
          <li className="text-sm text-muted-foreground">Aucun message pour le moment.</li>
        )}
        {messages.map((m) => (
          <li
            key={m.id}
            className={`rounded-lg border border-border p-3 ${
              m.is_mine ? "bg-primary/5" : "bg-card"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{m.sender_name}</span>
              <span>{fmtTime(m.created_at)}</span>
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
            {m.is_mine && m.message_status === "sent" && (
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={() => void onDelete(m.id)}
                  className="text-xs text-destructive hover:underline"
                >
                  Supprimer
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-lg border border-border bg-card p-4">
        <label htmlFor="msg-body" className="text-sm font-medium">
          Nouveau message
        </label>
        <textarea
          id="msg-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          rows={3}
          className="mt-2 w-full rounded-md border border-input bg-background p-2 text-sm"
          placeholder="Écrivez votre message…"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{body.length} / 4000</span>
          <Button onClick={() => void onSend()} disabled={sending || !body.trim()}>
            {sending ? "Envoi…" : "Envoyer"}
          </Button>
        </div>
      </div>
    </div>
  );
}

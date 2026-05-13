import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (search: Record<string, unknown>) => ({
    sent: search.sent === true || search.sent === "true",
  }),
  component: VerifyEmailPage,
  head: () => ({ meta: [{ title: "Vérifier votre adresse — PartageCo" }] }),
});

function VerifyEmailPage() {
  const { sent } = Route.useSearch();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center">
        <h1 className="text-xl font-semibold">Vérifiez votre adresse email</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {sent
            ? "Nous venons de vous envoyer un email de vérification. Cliquez sur le lien reçu pour activer votre compte."
            : "Votre compte est en attente de vérification. Consultez la boîte mail associée à votre inscription."}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Tant que votre email n'est pas vérifié, votre compte reste en statut
          « en attente de vérification » et les actions de la marketplace ne sont
          pas disponibles.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Se connecter
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

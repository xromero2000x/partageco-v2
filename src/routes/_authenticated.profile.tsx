import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "Mon profil — PartageCo" }] }),
});

function ProfilePage() {
  const { appUser, profile, refresh } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!appUser) return;
    if (displayName.trim().length < 2) {
      setError("Le nom d'affichage doit contenir au moins 2 caractères.");
      return;
    }
    setSubmitting(true);
    const { error: err } = await supabase
      .from("user_profiles")
      .update({ display_name: displayName.trim(), updated_at: new Date().toISOString() })
      .eq("user_id", appUser.id);
    setSubmitting(false);
    if (err) {
      setError("Impossible d'enregistrer la modification.");
      return;
    }
    await refresh();
    toast.success("Profil mis à jour.");
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Mon profil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gérez vos informations personnelles et l'accès à votre compte.
        </p>
      </header>

      <section className="rounded-lg border border-border p-6">
        <h2 className="text-base font-medium">Informations</h2>
        <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Adresse email</Label>
            <Input
              id="email"
              type="email"
              value={appUser?.email ?? ""}
              disabled
              aria-describedby="email-help"
            />
            <p id="email-help" className="text-xs text-muted-foreground">
              La modification de l'email n'est pas disponible dans cette version.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="display_name">Nom d'affichage</Label>
            <Input
              id="display_name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              minLength={2}
              maxLength={50}
              required
            />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </section>

      <section className="mt-6 rounded-lg border border-border p-6">
        <h2 className="text-base font-medium">État du compte</h2>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Statut</dt>
            <dd className="font-medium">{appUser?.account_status}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email vérifié</dt>
            <dd className="font-medium">
              {appUser?.email_verified_at ? "Oui" : "Non"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-lg border border-border p-6">
        <h2 className="text-base font-medium">Suppression de compte</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La demande de suppression de compte (RGPD) sera disponible dans une
          prochaine étape du développement, conformément au cycle validé :
          demande, revue administrateur, complétion ou rejet justifié.
        </p>
      </section>
    </div>
  );
}

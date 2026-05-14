import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { updateMyProfile } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { toast } from "sonner";

const PROFILE_ERROR_MAP: Record<string, string> = {
  display_name_too_short: "Le nom d'affichage doit contenir au moins 2 caractères.",
  display_name_too_long: "Le nom d'affichage ne peut pas dépasser 80 caractères.",
  bio_too_long: "La bio ne peut pas dépasser 500 caractères.",
  update_failed: "Impossible d'enregistrer la modification.",
};

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "Mon profil — PartageCo" }] }),
});

function ProfilePage() {
  const { appUser, profile, refresh } = useAuth();
  const save = useServerFn(updateMyProfile);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!appUser) return;
    setSubmitting(true);
    try {
      await save({
        data: {
          display_name: displayName,
          bio: bio.trim() || null,
        },
      });
      await refresh();
      toast.success("Profil mis à jour.");
    } catch (e) {
      const code = e instanceof Error ? e.message : "update_failed";
      setError(PROFILE_ERROR_MAP[code] ?? "Impossible d'enregistrer la modification.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Mon profil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gérez vos informations personnelles et l'accès à votre compte.
        </p>
      </header>

      {/* Photo de profil */}
      {appUser && (
        <section className="rounded-lg border border-border p-6">
          <h2 className="text-base font-medium">Photo de profil</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Une photo claire rassure les autres membres et booste vos chances d'être accepté.
          </p>
          <div className="mt-5">
            <AvatarUploader
              userId={appUser.id}
              displayName={profile?.display_name ?? appUser.email}
              avatarUrl={profile?.avatar_url ?? null}
              onChange={refresh}
            />
          </div>
          {profile?.user_id && (
            <p className="mt-4 text-xs">
              <Link
                to="/u/$userId"
                params={{ userId: profile.user_id }}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Voir mon profil public →
              </Link>
            </p>
          )}
        </section>
      )}

      <section className="mt-6 rounded-lg border border-border p-6">
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
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Quelques mots sur vous : ce que vous partagez, vos habitudes, etc."
              aria-describedby="bio-help"
            />
            <p id="bio-help" className="text-xs text-muted-foreground">
              {bio.length}/500 caractères. Visible sur votre profil public.
            </p>
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
        <h2 className="text-base font-medium">Sécurité et suppression</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Les demandes liées à la sécurité et à la suppression du compte sont disponibles dans l'espace Sécurité.
        </p>
        <p className="mt-3">
          <Link
            to="/securite"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Accéder à Sécurité →
          </Link>
        </p>
      </section>
    </div>
  );
}

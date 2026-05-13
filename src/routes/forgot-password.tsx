import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
  head: () => ({ meta: [{ title: "Mot de passe oublié — PartageCo" }] }),
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (err) {
      setError("Une erreur est survenue. Veuillez réessayer.");
      return;
    }
    setDone(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">Mot de passe oublié</h1>
        {done ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Si un compte existe avec cette adresse, vous allez recevoir un email
            contenant un lien pour réinitialiser votre mot de passe.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Adresse email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Envoi…" : "Envoyer le lien de réinitialisation"}
            </Button>
          </form>
        )}
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="text-muted-foreground hover:text-foreground">
            ← Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}

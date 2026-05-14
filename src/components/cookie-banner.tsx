import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "partageco.cookies.v1";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // localStorage indisponible (SSR / privé) — on n'affiche pas la bannière
    }
  }, []);

  const decide = (choice: "accepted" | "rejected") => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ choice, at: new Date().toISOString() }),
      );
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Préférences cookies"
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 sm:px-6 sm:pb-6"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur sm:p-5">
        <h2 className="text-sm font-semibold text-foreground">
          Cookies & vie privée
        </h2>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Nous utilisons des cookies strictement nécessaires au fonctionnement du
          site (session, sécurité). Aucun cookie de mesure d'audience ou de
          publicité n'est déposé sans votre accord.{" "}
          <Link
            to="/legal/cookies"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            En savoir plus
          </Link>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => decide("accepted")}>
            J'accepte
          </Button>
          <Button size="sm" variant="outline" onClick={() => decide("rejected")}>
            Refuser les cookies optionnels
          </Button>
        </div>
      </div>
    </div>
  );
}

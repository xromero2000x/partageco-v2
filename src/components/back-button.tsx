import { useRouter, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type Fallback = "/" | "/dashboard" | "/admin/litiges";

interface BackButtonProps {
  fallback?: Fallback;
  className?: string;
  label?: string;
}

/**
 * Bouton « Retour » accessible.
 * - Utilise l'historique du routeur si disponible.
 * - Sinon redirige vers la route sûre `fallback`.
 * - Ne crée aucune route, n'affiche aucune donnée métier.
 */
export function BackButton({
  fallback = "/",
  className,
  label = "Retour",
}: BackButtonProps) {
  const router = useRouter();
  const navigate = useNavigate();

  const handleClick = () => {
    const canGoBack =
      typeof window !== "undefined" && window.history.length > 1;
    if (canGoBack) {
      router.history.back();
      return;
    }
    void navigate({ to: fallback });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      aria-label={label}
      className={
        "rounded-full focus-visible:ring-2 focus-visible:ring-ring " +
        (className ?? "")
      }
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      <span className="ml-1.5">{label}</span>
    </Button>
  );
}

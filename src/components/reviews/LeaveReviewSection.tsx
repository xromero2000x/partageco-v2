import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createReview, getMyReviewForCoSub } from "@/lib/reviews.functions";

const REVIEW_ERROR_MAP: Record<string, string> = {
  forbidden: "Vous ne pouvez pas évaluer cette participation.",
  not_found: "Participation introuvable.",
  review_not_allowed_yet: "L'avis sera disponible une fois la participation active.",
  review_already_exists: "Vous avez déjà laissé un avis pour cette participation.",
  comment_too_long: "Le commentaire ne peut pas dépasser 1000 caractères.",
  generic_error: "Une erreur est survenue.",
};

export function LeaveReviewSection({
  coSubId,
  ownerName,
}: {
  coSubId: string;
  ownerName: string;
}) {
  const qc = useQueryClient();
  const fetchMine = useServerFn(getMyReviewForCoSub);
  const submitReview = useServerFn(createReview);

  const { data, isLoading } = useQuery({
    queryKey: ["my-review", coSubId],
    queryFn: () => fetchMine({ data: { coSubId } }),
  });

  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) {
    return (
      <section className="mt-6 rounded-lg border border-border p-6 text-sm text-muted-foreground">
        Chargement…
      </section>
    );
  }

  const existing = data?.review;

  if (existing) {
    return (
      <section className="mt-6 rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-medium">Votre avis</h2>
        <div className="mt-3 flex items-center gap-1" aria-label={`${existing.rating} sur 5`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={`h-5 w-5 ${
                n <= existing.rating
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/30"
              }`}
              aria-hidden="true"
            />
          ))}
          <span className="ml-2 text-sm font-medium">{existing.rating}/5</span>
        </div>
        {existing.comment && (
          <p className="mt-3 whitespace-pre-line text-sm text-foreground">
            {existing.comment}
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Avis publié le{" "}
          {new Date(existing.created_at).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </section>
    );
  }

  const onSubmit = async () => {
    if (rating < 1) {
      toast.error("Sélectionnez une note de 1 à 5 étoiles.");
      return;
    }
    setSubmitting(true);
    try {
      await submitReview({
        data: {
          co_subscription_id: coSubId,
          rating,
          comment: comment.trim() || null,
        },
      });
      toast.success("Merci pour votre avis !");
      await qc.invalidateQueries({ queryKey: ["my-review", coSubId] });
    } catch (e) {
      const code = e instanceof Error ? e.message : "generic_error";
      toast.error(REVIEW_ERROR_MAP[code] ?? code);
    } finally {
      setSubmitting(false);
    }
  };

  const display = hover || rating;

  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-6">
      <h2 className="text-base font-medium">Évaluer cette participation</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Votre avis sur {ownerName} aidera les autres membres à choisir en confiance.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <Label className="text-sm">Note</Label>
          <div
            className="mt-2 flex items-center gap-1"
            onMouseLeave={() => setHover(0)}
            role="radiogroup"
            aria-label="Note de 1 à 5 étoiles"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
                onMouseEnter={() => setHover(n)}
                onClick={() => setRating(n)}
                className="rounded p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Star
                  className={`h-7 w-7 transition ${
                    n <= display
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/40"
                  }`}
                  aria-hidden="true"
                />
              </button>
            ))}
            {rating > 0 && (
              <span className="ml-2 text-sm font-medium">{rating}/5</span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="review-comment" className="text-sm">
            Commentaire <span className="text-muted-foreground">(optionnel)</span>
          </Label>
          <Textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="Décrivez votre expérience : réactivité, fiabilité, qualité du partage…"
          />
          <p className="text-xs text-muted-foreground">{comment.length}/1000 caractères</p>
        </div>

        <Button
          type="button"
          onClick={onSubmit}
          disabled={submitting || rating < 1}
        >
          {submitting ? "Envoi…" : "Publier mon avis"}
        </Button>
      </div>
    </section>
  );
}

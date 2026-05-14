import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ShieldCheck, Star } from "lucide-react";
import { getPublicProfile } from "@/lib/profiles.functions";

export const Route = createFileRoute("/u/$userId")({
  loader: async ({ params }) => {
    try {
      return await getPublicProfile({ data: { userId: params.userId } });
    } catch {
      throw notFound();
    }
  },
  component: PublicProfilePage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">Profil introuvable</h1>
      <Link to="/marketplace" className="mt-6 inline-block text-sm underline">
        Retour à la marketplace
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">Erreur</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.profile.display_name ?? "Profil"} — PartageCo` },
      {
        name: "description",
        content: `Profil public de ${loaderData?.profile.display_name ?? "ce membre"} sur PartageCo.`,
      },
    ],
  }),
});

const AVATAR_GRADIENTS = [
  "from-rose-400 to-pink-600",
  "from-amber-400 to-orange-600",
  "from-emerald-400 to-teal-600",
  "from-sky-400 to-indigo-600",
  "from-violet-400 to-fuchsia-600",
  "from-cyan-400 to-blue-600",
];
function gradientFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}
function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}
function fmtFullDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-4 w-4 ${
            n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
          }`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function PublicProfilePage() {
  const { profile, reviews } = Route.useLoaderData();
  const grad = gradientFor(profile.user_id);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          to="/marketplace"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          ← Marketplace
        </Link>

        {/* Header card */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-8 text-center">
          <div
            className={`mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br ${grad} text-3xl font-semibold text-white shadow-md ring-4 ring-background`}
            aria-hidden="true"
          >
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(profile.display_name)
            )}
          </div>

          <div className="mt-4 flex items-center justify-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {profile.display_name}
            </h1>
            {profile.email_verified && (
              <ShieldCheck className="h-5 w-5 text-primary" aria-label="Email vérifié" />
            )}
          </div>

          {/* Score */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm">
            {profile.rating_count > 0 ? (
              <>
                <StarRow rating={Math.round(profile.rating_avg ?? 0)} />
                <span className="font-semibold text-foreground">
                  {profile.rating_avg?.toFixed(1)}
                </span>
                <span className="text-muted-foreground">
                  · {profile.rating_count} avis
                </span>
              </>
            ) : (
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                Nouveau membre — pas encore d'avis
              </span>
            )}
          </div>

          {profile.member_since && (
            <p className="mt-2 text-xs text-muted-foreground">
              Membre depuis {fmtDate(profile.member_since)}
            </p>
          )}

          {profile.bio && (
            <p className="mx-auto mt-5 max-w-xl text-sm text-muted-foreground">
              {profile.bio}
            </p>
          )}

          <div className="mt-6 flex justify-center gap-3 text-xs text-muted-foreground">
            <span className="rounded-full border border-border px-3 py-1">
              {profile.active_offers_count} offre
              {profile.active_offers_count > 1 ? "s" : ""} active
              {profile.active_offers_count > 1 ? "s" : ""}
            </span>
          </div>
        </section>

        {/* Reviews */}
        <section className="mt-10" aria-labelledby="reviews-title">
          <h2 id="reviews-title" className="text-xl font-semibold tracking-tight">
            Avis des participants
          </h2>

          {reviews.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Aucun avis pour le moment. Soyez le premier à rejoindre une offre de ce
              membre pour laisser un avis.
            </p>
          ) : (
            <ul className="mt-5 space-y-4" role="list">
              {reviews.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border border-border bg-card p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">
                      {r.reviewer_display_name}
                    </p>
                    <StarRow rating={r.rating} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {fmtFullDate(r.created_at)}
                  </p>
                  {r.comment && (
                    <p className="mt-3 whitespace-pre-line text-sm text-foreground">
                      {r.comment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

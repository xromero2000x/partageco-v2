// Mapping slug de service → visuel généré en Phase 14B (image originale,
// AUCUN logo officiel ni élément de marque protégé). Si le slug n'a pas de
// visuel dédié, le composant doit utiliser le fallback CSS neutre PartageCo.
import netflix from "@/assets/services/netflix.jpg";
import disneyPlus from "@/assets/services/disney_plus.jpg";
import crunchyroll from "@/assets/services/crunchyroll.jpg";
import spotify from "@/assets/services/spotify.jpg";
import youtubePremium from "@/assets/services/youtube_premium.jpg";

const VISUALS: Record<string, string> = {
  netflix,
  disney_plus: disneyPlus,
  crunchyroll,
  spotify,
  youtube_premium: youtubePremium,
};

export function getServiceVisual(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return VISUALS[slug] ?? null;
}

// Ordre d'affichage prioritaire des sections marketplace.
export const SERVICE_DISPLAY_ORDER = [
  "netflix",
  "disney_plus",
  "crunchyroll",
  "spotify",
  "youtube_premium",
];

// Regroupement UX d'affichage des services par "rayon" marketplace.
// Ce regroupement est purement frontend : il ne modifie pas les
// `subscription_categories` en base. YouTube Premium est rattaché
// techniquement à `streaming_video` mais affiché ici sous "Musique".
export type DisplayCategoryKey = "video" | "music";

export const DISPLAY_CATEGORIES: {
  key: DisplayCategoryKey;
  name: string;
  serviceSlugs: string[];
}[] = [
  {
    key: "video",
    name: "Film & vidéo",
    serviceSlugs: ["netflix", "crunchyroll", "disney_plus"],
  },
  {
    key: "music",
    name: "Musique",
    serviceSlugs: ["spotify", "youtube_premium"],
  },
];

export const NON_AFFILIATION_NOTICE =
  "Les noms de services sont utilisés uniquement pour décrire les abonnements partagés par les utilisateurs. PartageCo n'est affilié à aucun service cité.";

export const MVP_NOTICE =
  "Simulation MVP — aucun paiement réel n'est exécuté.";

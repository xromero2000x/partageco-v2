// Codes couleur évocateurs par service (inspirés mais NON-officiels).
// Utilisés uniquement pour identifier visuellement un service partagé par
// les utilisateurs ; PartageCo n'est affilié à aucun service cité.

export type ServiceBranding = {
  // Gradient CSS appliqué en fond de carte
  background: string;
  // Couleur du texte sur le fond
  foreground: string;
  // Couleur d'accent (séparateur, prix)
  accent: string;
};

const DEFAULT_BRANDING: ServiceBranding = {
  background: "linear-gradient(135deg, hsl(220 30% 22%), hsl(220 25% 14%))",
  foreground: "#ffffff",
  accent: "rgba(255,255,255,0.7)",
};

const BRANDING: Record<string, ServiceBranding> = {
  netflix: {
    background: "linear-gradient(160deg, #2a0608 0%, #6b0a10 55%, #0a0a0a 100%)",
    foreground: "#ffffff",
    accent: "rgba(255,255,255,0.75)",
  },
  "disney-plus": {
    background: "linear-gradient(160deg, #0a1a4a 0%, #1a3aa8 55%, #06122e 100%)",
    foreground: "#ffffff",
    accent: "rgba(255,255,255,0.75)",
  },
  crunchyroll: {
    background: "linear-gradient(160deg, #ff8a3d 0%, #f47521 55%, #b04a0d 100%)",
    foreground: "#ffffff",
    accent: "rgba(255,255,255,0.85)",
  },
  spotify: {
    background: "linear-gradient(160deg, #1ed760 0%, #1db954 55%, #0a4a23 100%)",
    foreground: "#0a0a0a",
    accent: "rgba(10,10,10,0.75)",
  },
  "youtube-premium": {
    background: "linear-gradient(160deg, #ff4a4a 0%, #cc0000 55%, #1a0303 100%)",
    foreground: "#ffffff",
    accent: "rgba(255,255,255,0.8)",
  },
  deezer: {
    background: "linear-gradient(160deg, #a238ff 0%, #ef5466 55%, #2d0d3a 100%)",
    foreground: "#ffffff",
    accent: "rgba(255,255,255,0.8)",
  },
  "apple-music": {
    background: "linear-gradient(160deg, #fa233b 0%, #fb5c74 55%, #5a0a17 100%)",
    foreground: "#ffffff",
    accent: "rgba(255,255,255,0.8)",
  },
};

export function getServiceBranding(slug: string | null | undefined): ServiceBranding {
  if (!slug) return DEFAULT_BRANDING;
  return BRANDING[slug] ?? DEFAULT_BRANDING;
}

// Service-specific FAQ used on /marketplace/service/$serviceSlug.
// Inspired by Spliiit: rassurance + questions concrètes liées au service.

export type FaqEntry = { q: string; a: string };

const COMMON: FaqEntry[] = [
  {
    q: "Le propriétaire de l'abonnement peut-il voir ce que je regarde ou écoute ?",
    a: "Non. Sur la plupart des services, chaque profil est indépendant : votre activité, vos recommandations et votre historique restent privés et ne sont pas accessibles aux autres membres du foyer.",
  },
  {
    q: "Est-ce que c'est facile de se co-abonner ?",
    a: "Oui. Vous envoyez une demande au propriétaire depuis l'offre, il l'accepte, et vous recevez ensuite par messagerie interne les informations nécessaires pour accéder à votre profil.",
  },
  {
    q: "Puis-je quitter le co-abonnement à tout moment ?",
    a: "Oui. Vous pouvez mettre fin à votre participation depuis « Mes participations ». Aucune reconduction tacite : vous reprenez la main quand vous le souhaitez.",
  },
  {
    q: "Comment se passe le paiement ?",
    a: "Pendant la phase MVP de PartageCo, aucun paiement réel n'est exécuté : les montants affichés sont indicatifs. Les flux financiers seront activés ultérieurement avec un prestataire sécurisé.",
  },
];

const BY_SERVICE: Record<string, FaqEntry[]> = {
  netflix: [
    {
      q: "Est-ce légal de partager mon abonnement Netflix ?",
      a: "Netflix autorise le partage à l'intérieur d'un même foyer. PartageCo ne fournit pas l'abonnement : la marketplace met en relation des personnes qui souhaitent organiser un partage entre elles, conformément aux conditions du service choisi.",
    },
    {
      q: "Combien de profils sont disponibles sur un compte Netflix ?",
      a: "Selon la formule (Standard, Premium…), Netflix permet plusieurs profils simultanés. Le nombre de places affiché par chaque offre correspond aux profils encore libres sur le compte du propriétaire.",
    },
    {
      q: "Vais-je avoir mon propre profil Netflix ?",
      a: "Oui. Vous disposez de votre profil personnel avec vos recommandations, votre historique et votre liste — indépendamment du propriétaire et des autres co-abonnés.",
    },
  ],
  "disney-plus": [
    {
      q: "Est-ce légal de partager mon abonnement Disney+ ?",
      a: "Disney+ autorise le partage au sein d'un même foyer. PartageCo se contente de mettre en relation des utilisateurs ; le respect des conditions Disney+ relève de l'organisation entre les co-abonnés.",
    },
    {
      q: "Combien de profils peut-on créer sur Disney+ ?",
      a: "Disney+ permet plusieurs profils par compte avec contrôle parental. Chaque place proposée correspond à un profil disponible chez le propriétaire.",
    },
    {
      q: "Aurai-je accès à tout le catalogue Disney+ ?",
      a: "Oui, le catalogue est commun à tous les profils du compte (Disney, Pixar, Marvel, Star Wars, National Geographic, Star).",
    },
  ],
  crunchyroll: [
    {
      q: "Est-ce légal de partager mon abonnement Crunchyroll ?",
      a: "Crunchyroll Mega Fan et Ultimate Fan autorisent plusieurs écrans simultanés. PartageCo met en relation des utilisateurs souhaitant partager un même abonnement dans le respect de ces conditions.",
    },
    {
      q: "Combien de personnes peuvent regarder en même temps ?",
      a: "Selon la formule du propriétaire (Mega Fan, Ultimate Fan), 4 à 6 écrans simultanés sont possibles. Les places affichées correspondent aux écrans encore disponibles.",
    },
    {
      q: "Aurai-je un profil personnel ?",
      a: "Oui. Crunchyroll permet plusieurs profils, ce qui garde votre liste, votre historique et vos préférences linguistiques séparés des autres co-abonnés.",
    },
  ],
  spotify: [
    {
      q: "Est-ce légal de partager mon abonnement Spotify Famille ?",
      a: "Spotify Famille est conçu pour un foyer (jusqu'à 6 comptes Premium). PartageCo facilite l'organisation entre personnes souhaitant mutualiser un abonnement, dans le respect des conditions Spotify.",
    },
    {
      q: "Vais-je garder mes playlists et mon historique d'écoute ?",
      a: "Oui. Chaque membre conserve son propre compte Spotify avec ses playlists, son historique « Made for You » et ses recommandations personnalisées.",
    },
    {
      q: "Pourrai-je écouter en même temps que les autres co-abonnés ?",
      a: "Oui. Spotify Famille autorise l'écoute simultanée sur tous les comptes du plan, sans limitation entre les membres.",
    },
  ],
  "youtube-premium": [
    {
      q: "Est-ce légal de partager mon abonnement YouTube Premium ?",
      a: "YouTube Premium Famille permet de partager l'abonnement avec les membres d'un même foyer (jusqu'à 5 personnes + le propriétaire). PartageCo met en relation les personnes souhaitant organiser ce partage.",
    },
    {
      q: "Aurai-je YouTube Music et la lecture sans publicité ?",
      a: "Oui. Chaque membre du plan Famille bénéficie de YouTube sans publicité, du téléchargement, de la lecture en arrière-plan et de YouTube Music Premium.",
    },
    {
      q: "Mon historique YouTube reste-t-il privé ?",
      a: "Oui. Chaque membre conserve son propre compte Google : recommandations, historique et abonnements ne sont pas partagés avec les autres co-abonnés.",
    },
  ],
};

export function getServiceFaq(slug: string | null | undefined, serviceName?: string | null): FaqEntry[] {
  const specific = (slug && BY_SERVICE[slug]) || [];
  if (specific.length > 0) return [...specific, ...COMMON];

  // Fallback générique adapté avec le nom du service.
  const name = serviceName ?? "ce service";
  return [
    {
      q: `Est-ce légal de partager mon abonnement ${name} ?`,
      a: `La plupart des services autorisent le partage au sein d'un même foyer. PartageCo n'est pas affilié à ${name} et se limite à mettre en relation des utilisateurs souhaitant organiser un partage dans le respect des conditions du service.`,
    },
    {
      q: `Aurai-je un accès personnel à ${name} ?`,
      a: `Oui. Selon les fonctionnalités de ${name}, vous disposez de votre propre profil ou compte secondaire afin que votre activité reste séparée de celle du propriétaire.`,
    },
    ...COMMON,
  ];
}

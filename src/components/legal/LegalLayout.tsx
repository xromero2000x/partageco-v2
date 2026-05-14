import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export function LegalLayout({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        to="/"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Accueil
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{title}</h1>
      {updatedAt && (
        <p className="mt-1 text-xs text-muted-foreground">
          Dernière mise à jour : {updatedAt}
        </p>
      )}
      <div className="prose prose-sm mt-8 max-w-none text-foreground prose-headings:text-foreground prose-headings:font-semibold prose-h2:mt-8 prose-h2:text-xl prose-h3:mt-5 prose-h3:text-base prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-a:text-primary">
        {children}
      </div>
      <p className="mt-12 rounded-md border border-dashed border-border bg-muted/40 p-4 text-xs text-muted-foreground">
        <strong className="font-medium text-foreground">Modèle MVP.</strong>{" "}
        Ce document est fourni à titre indicatif et doit être validé par un conseil
        juridique avant ouverture commerciale.
      </p>
    </div>
  );
}

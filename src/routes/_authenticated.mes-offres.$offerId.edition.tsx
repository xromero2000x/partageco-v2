import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import {
  getOfferEditAuthorization,
  listCategories,
  listServices,
  listServicePlans,
  updateOffer,
} from "@/lib/offers.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mes-offres/$offerId/edition")({
  component: EditOfferPage,
  head: () => ({ meta: [{ title: "Édition de l'offre — PartageCo" }] }),
});

const REASON_LABELS: Record<string, string> = {
  account_not_active: "Votre compte n'est pas actif.",
  email_not_verified: "Votre adresse email n'est pas vérifiée.",
  offer_not_editable: "Cette offre n'est pas modifiable dans son statut actuel.",
};

function EditOfferPage() {
  const { offerId } = Route.useParams();
  const navigate = useNavigate();

  const probeFn = useServerFn(getOfferEditAuthorization);
  const fetchCats = useServerFn(listCategories);
  const fetchSvcs = useServerFn(listServices);
  const fetchPlans = useServerFn(listServicePlans);
  const submit = useServerFn(updateOffer);

  const probe = useQuery({
    queryKey: ["offer-edit-auth", offerId],
    queryFn: () => probeFn({ data: { offerId } }),
  });
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => fetchCats() });

  const [categoryId, setCategoryId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [servicePlanId, setServicePlanId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [totalSlots, setTotalSlots] = useState(1);
  const [price, setPrice] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (probe.data?.offer && !hydrated) {
      const o = probe.data.offer;
      setCategoryId(o.category_id);
      setServiceId(o.service_id);
      setServicePlanId(o.service_plan_id ?? "");
      setTitle(o.title);
      setDescription(o.description ?? "");
      setTotalSlots(o.total_slots);
      setPrice(Number(o.monthly_price_amount));
      setHydrated(true);
    }
  }, [probe.data, hydrated]);

  const svcs = useQuery({
    queryKey: ["services", categoryId],
    queryFn: () => fetchSvcs({ data: { categoryId: categoryId || undefined } }),
    enabled: !!categoryId,
  });
  const plans = useQuery({
    queryKey: ["service-plans", serviceId],
    queryFn: () => fetchPlans({ data: { serviceId } }),
    enabled: !!serviceId,
  });

  if (probe.isLoading) {
    return <p className="mx-auto max-w-3xl px-6 py-10 text-sm text-muted-foreground">Chargement…</p>;
  }
  if (probe.error || !probe.data) {
    return (
      <p role="alert" className="mx-auto max-w-3xl px-6 py-10 text-sm text-destructive">
        Impossible de charger cette offre.
      </p>
    );
  }

  const { canEdit, reasons, mustPauseFirst, offer } = probe.data;

  if (mustPauseFirst) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/mes-offres/$offerId" params={{ offerId }} className="text-sm text-muted-foreground hover:text-foreground">
          ← Retour à l'offre
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{offer.title}</h1>
        <p className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm">
          Cette offre doit être mise en pause avant modification.
        </p>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/mes-offres/$offerId" params={{ offerId }} className="text-sm text-muted-foreground hover:text-foreground">
          ← Retour à l'offre
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Modification refusée</h1>
        <ul className="mt-4 list-disc pl-6 text-sm text-muted-foreground">
          {reasons.map((r) => <li key={r}>{REASON_LABELS[r] ?? r}</li>)}
        </ul>
      </div>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await submit({
        data: {
          offerId,
          patch: {
            service_id: serviceId,
            category_id: categoryId,
            service_plan_id: servicePlanId,
            title: title.trim(),
            description: description.trim() || null,
            total_slots: totalSlots,
            monthly_price_amount: price,
          },
        },
      });
      toast.success("Modifications enregistrées.");
      navigate({ to: "/mes-offres/$offerId", params: { offerId } });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  };

  const noPlanAvailable = !!serviceId && plans.data && plans.data.plans.length === 0;
  const planMissing = !servicePlanId;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link to="/mes-offres/$offerId" params={{ offerId }} className="text-sm text-muted-foreground hover:text-foreground">
        ← Retour à l'offre
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Édition de l'offre</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Simulation MVP — aucun paiement réel n'est exécuté.
      </p>
      {!offer.service_plan_id && (
        <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Cette offre n'a pas encore de gamme d'abonnement. Vous devez en sélectionner une avant d'enregistrer.
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="cat">Catégorie</Label>
          <select
            id="cat"
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setServiceId(""); setServicePlanId(""); }}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">— Choisir —</option>
            {(cats.data?.categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="svc">Service</Label>
          <select
            id="svc"
            value={serviceId}
            onChange={(e) => { setServiceId(e.target.value); setServicePlanId(""); }}
            required
            disabled={!categoryId}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">— Choisir —</option>
            {(svcs.data?.services ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {categoryId && svcs.data && svcs.data.services.length === 0 && (
            <p className="text-xs text-destructive">
              Aucun service actif n'est disponible pour cette catégorie.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="plan">Gamme d'abonnement</Label>
          <select
            id="plan"
            value={servicePlanId}
            onChange={(e) => setServicePlanId(e.target.value)}
            required
            disabled={!serviceId}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">— Choisir —</option>
            {(plans.data?.plans ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {noPlanAvailable && (
            <p className="text-xs text-destructive">
              Aucune gamme active n'est disponible pour ce service.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Titre</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} maxLength={120} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="desc">Description</Label>
          <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} rows={4} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="slots">Nombre total de places</Label>
            <Input id="slots" type="number" min={1} max={50} value={totalSlots} onChange={(e) => setTotalSlots(Number(e.target.value))} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">Montant indicatif mensuel (EUR)</Label>
            <Input id="price" type="number" min={0.01} step={0.01} max={10000} value={price} onChange={(e) => setPrice(Number(e.target.value))} required />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          La devise (EUR) et la périodicité (mensuelle) ne sont pas modifiables.
        </p>

        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}

        <Button type="submit" disabled={busy || !serviceId || !categoryId || planMissing}>
          {busy ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </form>
    </div>
  );
}

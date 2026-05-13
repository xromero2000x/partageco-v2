import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import {
  getAdminContext,
  listAdminCategoriesAndServices,
  createInternalService,
  updateInternalService,
  listAdminServicePlans,
  createServicePlan,
  updateServicePlan,
} from "@/lib/offers.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/categories-services")({
  component: AdminCategoriesServicesPage,
  head: () => ({ meta: [{ title: "Catégories & services — Admin" }] }),
});

function AdminCategoriesServicesPage() {
  const qc = useQueryClient();
  const ctxFn = useServerFn(getAdminContext);
  const listFn = useServerFn(listAdminCategoriesAndServices);
  const createFn = useServerFn(createInternalService);
  const updateFn = useServerFn(updateInternalService);

  const ctx = useQuery({ queryKey: ["admin-ctx"], queryFn: () => ctxFn() });
  const data = useQuery({
    queryKey: ["admin-categories-services"],
    queryFn: () => listFn(),
    enabled: !!ctx.data?.isSuper,
  });

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState("");

  if (ctx.isLoading) return <p className="mx-auto max-w-5xl px-6 py-10 text-sm text-muted-foreground">Chargement…</p>;
  if (!ctx.data?.isSuper) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">Accès refusé</h1>
        <p className="mt-2 text-sm text-muted-foreground">Cette section est réservée au super admin.</p>
        <Link to="/dashboard" className="mt-6 inline-block text-sm underline">Retour</Link>
      </div>
    );
  }

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await createFn({
        data: {
          category_id: categoryId,
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          is_active: true,
        },
      });
      toast.success("Service créé.");
      setName(""); setSlug(""); setCategoryId(""); setDescription("");
      await qc.invalidateQueries({ queryKey: ["admin-categories-services"] });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    if (!confirm(`${current ? "Désactiver" : "Activer"} ce service ? Cette action sera journalisée.`)) return;
    try {
      await updateFn({ data: { serviceId: id, patch: { is_active: !current } } });
      toast.success("Service mis à jour.");
      await qc.invalidateQueries({ queryKey: ["admin-categories-services"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  const startEditDescription = (id: string, current: string | null) => {
    setEditingId(id);
    setEditingDescription(current ?? "");
  };

  const saveDescription = async (id: string) => {
    if (!confirm("Enregistrer la description ? Cette action sera journalisée.")) return;
    try {
      await updateFn({
        data: {
          serviceId: id,
          patch: { description: editingDescription.trim() || null },
        },
      });
      toast.success("Description mise à jour.");
      setEditingId(null);
      setEditingDescription("");
      await qc.invalidateQueries({ queryKey: ["admin-categories-services"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Catégories & services</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Gestion interne du référentiel — réservée au super admin.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Catégories</h2>
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border text-sm">
          {(data.data?.categories ?? []).map((c) => (
            <li key={c.id} className="flex items-center justify-between p-3">
              <span>{c.name} <span className="text-xs text-muted-foreground">({c.slug})</span></span>
              <span className="text-xs text-muted-foreground">{c.is_active ? "Active" : "Inactive"}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Créer un service interne</h2>
        <form onSubmit={onCreate} className="mt-4 grid gap-4 rounded-lg border border-border p-5 sm:grid-cols-2" noValidate>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cat">Catégorie</Label>
            <select
              id="cat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— Choisir —</option>
              {(data.data?.categories ?? []).filter((c) => c.is_active).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Nom</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} required pattern="[a-z0-9-]+" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="desc">Description (optionnelle)</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Précisez les conditions ou particularités du service. Laisser vide si aucune."
            />
          </div>
          {err && <p role="alert" className="text-sm text-destructive sm:col-span-2">{err}</p>}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy || !categoryId}>{busy ? "Création…" : "Créer le service"}</Button>
          </div>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Services existants</h2>
        {data.isLoading && <p className="mt-3 text-sm text-muted-foreground">Chargement…</p>}
        {data.data && data.data.services.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">Aucun service défini.</p>
        )}
        {data.data && data.data.services.length > 0 && (
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
            {data.data.services.map((s) => {
              const cat = data.data!.categories.find((c) => c.id === s.category_id);
              const isEditing = editingId === s.id;
              return (
                <li key={s.id} className="p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{s.name} <span className="text-xs text-muted-foreground">({s.slug})</span></div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {cat?.name ?? "—"} · {s.is_active ? "Actif" : "Inactif"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => isEditing ? setEditingId(null) : startEditDescription(s.id, s.description)}>
                        {isEditing ? "Annuler" : "Modifier la description"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleActive(s.id, s.is_active)}>
                        {s.is_active ? "Désactiver" : "Activer"}
                      </Button>
                    </div>
                  </div>
                  {!isEditing && s.description && (
                    <p className="mt-3 whitespace-pre-line text-muted-foreground">{s.description}</p>
                  )}
                  {!isEditing && !s.description && (
                    <p className="mt-3 text-xs italic text-muted-foreground">Aucune description.</p>
                  )}
                  {isEditing && (
                    <div className="mt-3 space-y-2">
                      <Textarea
                        value={editingDescription}
                        onChange={(e) => setEditingDescription(e.target.value)}
                        maxLength={2000}
                        rows={3}
                      />
                      <Button size="sm" onClick={() => saveDescription(s.id)}>Enregistrer</Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ServicePlansSection
        services={data.data?.services ?? []}
      />
    </div>
  );
}

function ServicePlansSection({ services }: { services: Array<{ id: string; name: string; is_active: boolean }> }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listAdminServicePlans);
  const createFn = useServerFn(createServicePlan);
  const updateFn = useServerFn(updateServicePlan);

  const plansQuery = useQuery({
    queryKey: ["admin-service-plans"],
    queryFn: () => listFn(),
  });

  const [serviceId, setServiceId] = useState("");
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await createFn({
        data: {
          service_id: serviceId,
          slug: slug.trim(),
          name: name.trim(),
          description: description.trim() || null,
          sort_order: sortOrder,
          is_active: true,
        },
      });
      toast.success("Gamme créée.");
      setSlug(""); setName(""); setDescription(""); setSortOrder(0);
      await qc.invalidateQueries({ queryKey: ["admin-service-plans"] });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const togglePlan = async (id: string, current: boolean) => {
    if (!confirm(`${current ? "Désactiver" : "Réactiver"} cette gamme ? Cette action sera journalisée.`)) return;
    try {
      await updateFn({ data: { planId: id, patch: { is_active: !current } } });
      toast.success("Gamme mise à jour.");
      await qc.invalidateQueries({ queryKey: ["admin-service-plans"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur";
      if (msg === "plan_in_use") {
        toast.error("Impossible : des offres non archivées utilisent cette gamme.");
      } else {
        toast.error(msg);
      }
    }
  };

  const plansByService = new Map<string, Array<{ id: string; slug: string; name: string; sort_order: number; is_active: boolean }>>();
  for (const p of plansQuery.data?.plans ?? []) {
    const arr = plansByService.get(p.service_id) ?? [];
    arr.push(p);
    plansByService.set(p.service_id, arr);
  }

  const activeServices = services.filter((s) => s.is_active);

  return (
    <section className="mt-12">
      <h2 className="text-lg font-medium">Gammes d'abonnement par service</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Référentiel administrable des gammes (ex : Standard / Premium). La désactivation est interdite si une offre non archivée la référence.
      </p>

      <form onSubmit={onCreate} className="mt-4 grid gap-4 rounded-lg border border-border p-5 sm:grid-cols-2" noValidate>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="plan-svc">Service</Label>
          <select
            id="plan-svc"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">— Choisir —</option>
            {activeServices.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan-slug">Slug</Label>
          <Input id="plan-slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} required pattern="[a-z0-9_-]+" maxLength={64} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan-name">Nom affiché</Label>
          <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={1} maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan-order">Ordre d'affichage</Label>
          <Input id="plan-order" type="number" min={0} max={999} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="plan-desc">Description (optionnelle)</Label>
          <Textarea id="plan-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={2} />
        </div>
        {err && <p role="alert" className="text-sm text-destructive sm:col-span-2">{err}</p>}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy || !serviceId}>{busy ? "Création…" : "Créer la gamme"}</Button>
        </div>
      </form>

      <div className="mt-6 space-y-6">
        {activeServices.map((s) => {
          const list = plansByService.get(s.id) ?? [];
          return (
            <div key={s.id} className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold">{s.name}</h3>
              {list.length === 0 ? (
                <p className="mt-2 text-xs italic text-muted-foreground">Aucune gamme définie pour ce service.</p>
              ) : (
                <ul className="mt-2 divide-y divide-border text-sm">
                  {list.sort((a, b) => a.sort_order - b.sort_order).map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-2">
                      <span>
                        {p.name} <span className="text-xs text-muted-foreground">({p.slug}) · ordre {p.sort_order} · {p.is_active ? "Active" : "Inactive"}</span>
                      </span>
                      <Button size="sm" variant="outline" onClick={() => togglePlan(p.id, p.is_active)}>
                        {p.is_active ? "Désactiver" : "Réactiver"}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

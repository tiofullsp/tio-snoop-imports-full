"use client";

import React, { useState, useOptimistic, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Plus, Edit2, Eye, Copy, Trash2, AlertTriangle, Loader2, GripVertical } from "lucide-react";
import { Button } from "@/components/common/Button";
import { SearchInput } from "@/components/common/SearchInput";
import { Select } from "@/components/common/Select";
import { Toggle } from "@/components/common/Toggle";
import { Badge } from "@/components/common/Badge";
import { Modal } from "@/components/common/Modal";
import { formatCurrency } from "@/lib/formatters";
import { toggleProductField, deleteProduct, reorderProducts } from "@/lib/actions/products";
import { routes } from "@/lib/routes";
import { AVAILABILITY_LABELS } from "@/types";
import type { AdminProduct } from "@/lib/db/admin";

interface CategoryOption {
  value: string;
  label: string;
}

interface Props {
  initialProducts: AdminProduct[];
  categoryOptions: CategoryOption[];
}

export function ProdutosClient({ initialProducts, categoryOptions }: Props) {
  const [products, setOptimisticProducts] = useOptimistic(initialProducts);
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  // Categoria selecionada vive na URL (?categoria=...), não só em state local
  // — assim, ao entrar num produto pra editar e voltar, o filtro continua
  // selecionado em vez de resetar pra "Todas as categorias".
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const categoryFilter = searchParams.get("categoria") ?? "";
  const setCategoryFilter = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("categoria", value);
    else params.delete("categoria");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const catOptions = [
    { value: "", label: "Todas as categorias" },
    ...categoryOptions,
  ];

  // Reordenar só faz sentido com uma única categoria visível e sem busca
  // ativa — senão os índices arrastados não correspondem à lista completa
  // da categoria no banco.
  const reorderMode = categoryFilter !== "" && !search;

  const filtered = products
    .filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());
      const matchCat = !categoryFilter || p.category_id === categoryFilter;
      return matchSearch && matchCat;
    })
    .sort((a, b) =>
      a.category_id !== b.category_id
        ? a.category_id.localeCompare(b.category_id)
        : a.display_order - b.display_order
    );

  const handleReorderDrop = (targetId: string) => {
    const sourceId = draggedId;
    setDraggedId(null);
    setDragOverId(null);
    if (!sourceId || sourceId === targetId) return;

    const fromIdx = filtered.findIndex((p) => p.id === sourceId);
    const toIdx = filtered.findIndex((p) => p.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...filtered];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const orderedIds = reordered.map((p) => p.id);
    const catId = categoryFilter;

    startTransition(async () => {
      setOptimisticProducts((prev) => {
        const orderMap = new Map(orderedIds.map((id, idx) => [id, idx]));
        return prev.map((p) =>
          orderMap.has(p.id) ? { ...p, display_order: orderMap.get(p.id)! } : p
        );
      });
      await reorderProducts(catId, orderedIds);
    });
  };

  const handleToggle = (
    id: string,
    field: "is_active" | "is_featured",
    current: boolean
  ) => {
    startTransition(async () => {
      setOptimisticProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, [field]: !current } : p))
      );
      const result = await toggleProductField(id, field, !current);
      if (result.error) setError(result.error);
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;

    setError(null);
    setDeleting(true);
    startTransition(async () => {
      const result = await deleteProduct(id);
      setDeleting(false);
      setDeleteTarget(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOptimisticProducts((prev) => prev.filter((p) => p.id !== id));
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">Produtos</h1>
          <p className="text-sm text-muted mt-1">
            {filtered.length} produto{filtered.length !== 1 ? "s" : ""}{" "}
            encontrado{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href={routes.admin.novoProduto}>
          <Button variant="accent" leftIcon={<Plus size={16} />}>
            Criar produto
          </Button>
        </Link>
      </div>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">
          {error}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome ou SKU..."
          className="flex-1"
        />
        <div className="w-full sm:w-52">
          <Select
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={catOptions}
          />
        </div>
      </div>

      {categoryFilter === "" ? (
        <p className="text-xs text-muted">
          Selecione uma categoria acima para poder arrastar e reordenar os produtos.
        </p>
      ) : reorderMode ? (
        <p className="text-xs text-muted flex items-center gap-1.5">
          <GripVertical size={13} />
          Arraste os produtos pela linha para definir a ordem de exibição nesta categoria.
        </p>
      ) : (
        <p className="text-xs text-muted">
          Limpe a busca para poder reordenar os produtos desta categoria.
        </p>
      )}

      {/* Tabela */}
      <div className="bg-dark-surface rounded-2xl border border-dark-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-border bg-dark-alt">
                {reorderMode && <th className="w-8 px-2 py-3" />}
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                  Produto
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden md:table-cell">
                  Categoria
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                  Preço Pix
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                  Ativo
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider hidden sm:table-cell">
                  Destaque
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => {
                const thumb = product.media?.find((m) => m.type === "image");
                const catLabel =
                  categoryOptions.find((c) => c.value === product.category_id)
                    ?.label ?? "—";

                return (
                  <tr
                    key={product.id}
                    draggable={reorderMode}
                    onDragStart={() => reorderMode && setDraggedId(product.id)}
                    onDragOver={(e) => {
                      if (!reorderMode) return;
                      e.preventDefault();
                      if (draggedId && product.id !== draggedId) setDragOverId(product.id);
                    }}
                    onDragLeave={() =>
                      setDragOverId((prev) => (prev === product.id ? null : prev))
                    }
                    onDrop={(e) => {
                      if (!reorderMode) return;
                      e.preventDefault();
                      handleReorderDrop(product.id);
                    }}
                    onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
                    className={[
                      "border-b border-dark-border last:border-0 hover:bg-dark-hover transition-colors",
                      reorderMode ? "cursor-grab active:cursor-grabbing" : "",
                      draggedId === product.id ? "opacity-40" : "",
                      dragOverId === product.id ? "bg-accent/5 ring-1 ring-inset ring-accent/40" : "",
                    ].join(" ")}
                  >
                    {reorderMode && (
                      <td className="px-2 py-3 text-center text-muted/60">
                        <GripVertical size={14} />
                      </td>
                    )}
                    {/* Produto */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 flex-shrink-0 bg-dark-alt rounded-lg overflow-hidden">
                          {thumb ? (
                            <Image
                              src={thumb.url}
                              alt={product.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted text-xs">
                              ?
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-dark-text truncate max-w-[180px]">
                            {product.name}
                          </div>
                          <div className="text-xs text-muted font-mono">
                            {product.sku}
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Categoria */}
                    <td className="px-4 py-3 text-xs text-muted hidden md:table-cell">
                      {catLabel}
                    </td>
                    {/* Preço */}
                    <td className="px-4 py-3 font-bold text-dark-text">
                      {formatCurrency(product.price_pix)}
                    </td>
                    {/* Ativo */}
                    <td className="px-4 py-3">
                      <Toggle
                        checked={product.is_active}
                        onChange={() =>
                          handleToggle(
                            product.id,
                            "is_active",
                            product.is_active
                          )
                        }
                        size="sm"
                      />
                    </td>
                    {/* Destaque */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Toggle
                        checked={product.is_featured}
                        onChange={() =>
                          handleToggle(
                            product.id,
                            "is_featured",
                            product.is_featured
                          )
                        }
                        size="sm"
                      />
                    </td>
                    {/* Ações */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Link href={routes.admin.editarProduto(product.id)} title="Editar produto">
                          <button className="w-7 h-7 rounded-lg bg-dark-alt border border-dark-border flex items-center justify-center text-muted hover:text-accent hover:border-accent/40 hover:bg-accent/10 transition-all duration-150">
                            <Edit2 size={13} />
                          </button>
                        </Link>
                        <Link
                          href={routes.produto(product.slug)}
                          target="_blank"
                          title="Ver no site"
                        >
                          <button className="w-7 h-7 rounded-lg bg-dark-alt border border-dark-border flex items-center justify-center text-muted hover:text-info hover:border-info/40 hover:bg-info/10 transition-all duration-150">
                            <Eye size={13} />
                          </button>
                        </Link>
                        <Link
                          href={`${routes.admin.novoProduto}?duplicate=${product.id}`}
                          title="Duplicar produto (abre rascunho, nada é salvo até você publicar)"
                        >
                          <button className="w-7 h-7 rounded-lg bg-dark-alt border border-dark-border flex items-center justify-center text-muted hover:text-accent hover:border-accent/40 hover:bg-accent/10 transition-all duration-150">
                            <Copy size={13} />
                          </button>
                        </Link>
                        <span className="w-px h-5 bg-dark-border mx-0.5" />
                        <button
                          onClick={() => setDeleteTarget({ id: product.id, name: product.name })}
                          title="Excluir produto"
                          className="w-7 h-7 rounded-lg bg-dark-alt border border-dark-border flex items-center justify-center text-muted hover:text-danger hover:border-danger/40 hover:bg-danger/10 transition-all duration-150"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={reorderMode ? 7 : 6}
                    className="px-4 py-12 text-center text-muted text-sm"
                  >
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        size="sm"
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-danger/10 border border-danger/30 flex items-center justify-center">
            <AlertTriangle size={22} className="text-danger" />
          </div>
          <div>
            <h3 className="text-base font-bold text-dark-text mb-1.5">
              Excluir produto
            </h3>
            <p className="text-sm text-muted leading-relaxed">
              Você tem certeza que quer remover o produto{" "}
              <span className="text-dark-text font-semibold">
                &quot;{deleteTarget?.name}&quot;
              </span>
              ? Esta ação não pode ser desfeita.
            </p>
          </div>
          <div className="flex gap-3 w-full pt-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={confirmDelete}
              disabled={deleting}
              leftIcon={deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            >
              {deleting ? "Excluindo…" : "Excluir"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

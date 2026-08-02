"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Toggle } from "@/components/common/Toggle";
import { Tabs, TabContent } from "@/components/common/Tabs";
import { Modal } from "@/components/common/Modal";
import { Select } from "@/components/common/Select";
import {
  updateStoreSettings,
  inviteAdminUser,
  removeAdminUser,
  type StoreSettingsFormData,
} from "@/lib/actions/settings";
import type { AdminStoreSettings } from "@/lib/db/settings";
import type { AdminProfile } from "@/types";

const TABS = [
  { value: "loja", label: "Loja" },
  { value: "pagamentos", label: "Pagamentos" },
  { value: "frete", label: "Frete" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "usuarios", label: "Usuários" },
  { value: "aparencia", label: "Aparência" },
];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-dark-surface rounded-2xl border border-dark-border p-6 space-y-4">
      <h2 className="text-sm font-bold text-dark-text">{title}</h2>
      {children}
    </div>
  );
}

const EMPTY_INVITE = { email: "", password: "", name: "", role: "manager" as "owner" | "manager" | "viewer" };

interface Props {
  initialSettings: AdminStoreSettings;
  initialAdmins: AdminProfile[];
  currentAdminId: string;
}

export function ConfiguracoesClient({ initialSettings, initialAdmins, currentAdminId }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("loja");

  const [form, setForm] = useState<StoreSettingsFormData>({
    store_name: initialSettings.store_name,
    email: initialSettings.email ?? "",
    address: initialSettings.address ?? "",
    cnpj_cpf: initialSettings.cnpj_cpf ?? "",
    whatsapp_number: initialSettings.whatsapp_number,
    whatsapp_default_message: initialSettings.whatsapp_default_message,
    logo_url: initialSettings.logo_url ?? "",
    insurance_percentage: initialSettings.insurance_percentage,
    maintenance_mode: initialSettings.maintenance_mode,
  });

  const set = <K extends keyof StoreSettingsFormData>(key: K, value: StoreSettingsFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    setSaved(false);
    const result = await updateStoreSettings(form);
    setSaving(false);
    if ("error" in result) {
      setSaveError(result.error);
    } else {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    }
  };

  // ── Usuários administrativos ────────────────────────────────────────────
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState(EMPTY_INVITE);
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteError("");
    const result = await inviteAdminUser(invite.email, invite.password, invite.name, invite.role);
    setInviting(false);
    if ("error" in result) {
      setInviteError(result.error);
      return;
    }
    setInviteOpen(false);
    setInvite(EMPTY_INVITE);
    router.refresh();
  };

  const handleRemove = async (admin: AdminProfile) => {
    if (!confirm(`Remover o acesso de "${admin.name}"? Esta ação não pode ser desfeita.`)) return;
    const result = await removeAdminUser(admin.id);
    if ("error" in result) alert(result.error);
    else router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">Configurações</h1>
          <p className="text-sm text-muted mt-1">Gerencie as configurações da loja</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 size={14} /> Salvo
            </span>
          )}
          {saveError && (
            <span className="flex items-center gap-1.5 text-xs text-danger">
              <AlertCircle size={14} /> {saveError}
            </span>
          )}
          <Button variant="accent" leftIcon={<Save size={16} />} onClick={handleSave} isLoading={saving}>
            Salvar alterações
          </Button>
        </div>
      </div>

      <Tabs tabs={TABS} value={activeTab} onChange={setActiveTab}>
        <TabContent value="loja" active={activeTab}>
          <div className="space-y-4 mt-6">
            <SectionCard title="Informações da loja">
              <Input label="Nome da loja" value={form.store_name} onChange={(e) => set("store_name", e.target.value)} />
              <Input label="E-mail de contato" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              <Input label="Endereço" value={form.address} onChange={(e) => set("address", e.target.value)} />
              <Input label="CNPJ / CPF" placeholder="00.000.000/0001-00" value={form.cnpj_cpf} onChange={(e) => set("cnpj_cpf", e.target.value)} />
            </SectionCard>
            <SectionCard title="Seguro da mercadoria">
              <div className="max-w-[160px]">
                <Input
                  label="Porcentagem do seguro"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  rightIcon={<span className="text-xs">%</span>}
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={form.insurance_percentage}
                  onChange={(e) => set("insurance_percentage", Number(e.target.value))}
                />
              </div>
              <p className="text-xs text-muted">
                Aplicada sobre o subtotal da compra quando o cliente ativa o seguro no carrinho —
                acréscimo de {form.insurance_percentage}% no valor final do pedido.
              </p>
            </SectionCard>
            <SectionCard title="Modo de manutenção">
              <div className="flex items-center gap-4">
                <Toggle checked={form.maintenance_mode} onChange={(v) => set("maintenance_mode", v)} />
                <div>
                  <p className="text-sm text-dark-text">Loja em manutenção</p>
                  <p className="text-xs text-muted">Clientes verão uma página de manutenção em todo o site</p>
                </div>
              </div>
            </SectionCard>
          </div>
        </TabContent>

        <TabContent value="pagamentos" active={activeTab}>
          <div className="space-y-4 mt-6">
            <SectionCard title="Pagamento — Pix (SupraPay) + Cartão (Zendry)">
              <p className="text-sm text-muted leading-relaxed">
                O checkout gera automaticamente um QR Code Pix embutido na própria página, via
                SupraPay. Pagamento por cartão continua embutido também, processado pelo Zendry
                (com 3DS). O cliente escolhe Pix ou cartão na tela de pagamento do pedido. Não há
                configuração manual de chave Pix ou cartão nesta tela.
              </p>
              <p className="text-xs text-muted">
                As credenciais de integração (SupraPay e Zendry) ficam nas variáveis de ambiente do servidor, não aqui.
              </p>
            </SectionCard>
          </div>
        </TabContent>

        <TabContent value="frete" active={activeTab}>
          <div className="space-y-4 mt-6">
            <SectionCard title="Envio via Shopee">
              <p className="text-sm text-muted leading-relaxed">
                O frete não é calculado automaticamente no site. Após a confirmação do pagamento,
                o valor do envio (em geral entre R$ 40 e R$ 80) é combinado direto com o cliente
                pelo WhatsApp e cobrado separadamente pela Shopee.
              </p>
            </SectionCard>
          </div>
        </TabContent>

        <TabContent value="whatsapp" active={activeTab}>
          <div className="mt-6">
            <SectionCard title="Número do WhatsApp">
              <Input
                label="Número (com DDI e DDD)"
                value={form.whatsapp_number}
                onChange={(e) => set("whatsapp_number", e.target.value)}
                placeholder="5511999999999"
              />
              <Input
                label="Mensagem padrão"
                value={form.whatsapp_default_message}
                onChange={(e) => set("whatsapp_default_message", e.target.value)}
              />
              <div className="p-3 bg-dark-alt rounded-xl border border-dark-border text-xs text-muted">
                <p className="font-medium text-dark-text mb-1">Pré-visualização:</p>
                <code className="text-accent break-all">
                  https://wa.me/{form.whatsapp_number}?text={encodeURIComponent(form.whatsapp_default_message).slice(0, 40)}...
                </code>
              </div>
              <p className="text-xs text-muted">
                Usado no botão flutuante, no menu ("Atendimento"), no rodapé e no botão de interesse
                da página de produto.
              </p>
            </SectionCard>
          </div>
        </TabContent>

        <TabContent value="usuarios" active={activeTab}>
          <div className="mt-6">
            <SectionCard title="Usuários administrativos">
              <div className="space-y-3">
                {initialAdmins.map((admin) => (
                  <div key={admin.id} className="flex items-center justify-between p-3 bg-dark-alt rounded-xl border border-dark-border">
                    <div>
                      <p className="text-sm font-medium text-dark-text">{admin.name}</p>
                      <p className="text-xs text-muted">{admin.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={[
                          "text-xs px-2 py-1 rounded-lg border",
                          admin.role === "viewer"
                            ? "bg-muted/10 text-muted border-dark-border-light"
                            : "bg-accent/10 text-accent border-accent/20",
                        ].join(" ")}
                      >
                        {admin.role === "owner"
                          ? "Administrador"
                          : admin.role === "viewer"
                            ? "Somente visualização"
                            : "Operador"}
                      </span>
                      {admin.id !== currentAdminId && (
                        <button
                          onClick={() => handleRemove(admin)}
                          className="p-1.5 text-muted hover:text-danger transition-colors rounded-lg hover:bg-danger/10"
                          aria-label="Remover usuário"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="secondary" size="sm" onClick={() => setInviteOpen(true)}>
                + Convidar usuário
              </Button>
            </SectionCard>
          </div>
        </TabContent>

        <TabContent value="aparencia" active={activeTab}>
          <div className="space-y-4 mt-6">
            <SectionCard title="Cor de destaque">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  className="w-10 h-10 rounded-full border-2 border-white scale-110 transition-all bg-accent"
                  title="#f2b705"
                />
              </div>
              <p className="text-xs text-muted">Cor atual: <span className="text-accent font-bold">#f2b705 (Dourado premium)</span></p>
              <p className="text-xs text-muted">A identidade visual da loja é fixa na paleta oficial (preto, dourado e off-white).</p>
            </SectionCard>
            <SectionCard title="Logo">
              <Input
                label="URL do logo"
                placeholder="https://..."
                value={form.logo_url}
                onChange={(e) => set("logo_url", e.target.value)}
              />
              <p className="text-xs text-muted">
                Guardado nas configurações, mas o site ainda usa o arquivo fixo do projeto — trocar
                a logo exibida no header/rodapé exige alterar o arquivo, não só esta URL.
              </p>
            </SectionCard>
          </div>
        </TabContent>
      </Tabs>

      <Modal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} title="Convidar usuário">
        <form onSubmit={handleInvite} className="space-y-4">
          <Input label="Nome" value={invite.name} onChange={(e) => setInvite((p) => ({ ...p, name: e.target.value }))} required />
          <Input label="E-mail" type="email" value={invite.email} onChange={(e) => setInvite((p) => ({ ...p, email: e.target.value }))} required />
          <Input label="Senha" type="password" value={invite.password} onChange={(e) => setInvite((p) => ({ ...p, password: e.target.value }))} required helper="Mínimo de 6 caracteres." />
          <Select
            label="Função"
            value={invite.role}
            onChange={(v) => setInvite((p) => ({ ...p, role: v as "owner" | "manager" | "viewer" }))}
            options={[
              { value: "manager", label: "Operador" },
              { value: "owner", label: "Administrador" },
              { value: "viewer", label: "Somente visualização" },
            ]}
          />
          {invite.role === "viewer" && (
            <p className="text-xs text-muted -mt-2">
              Essa conta consegue ver e navegar por todo o painel, mas nenhuma alteração
              (salvar, excluir, enviar imagem etc.) é aceita — bloqueado no servidor.
            </p>
          )}
          {inviteError && <p className="text-sm text-danger">{inviteError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="accent" isLoading={inviting}>Convidar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

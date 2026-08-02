"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { QRCodeSVG } from "qrcode.react";
import { Copy, CheckCircle2, MessageCircle, Clock, Loader2, ExternalLink, ShieldCheck, CreditCard } from "lucide-react";
import { CheckoutSteps } from "@/components/public/CheckoutSteps";
import { Container } from "@/components/common/SectionHeader";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Select";
import { routes } from "@/lib/routes";
import { formatCurrency } from "@/lib/formatters";
import { generateStoreWhatsAppLink } from "@/lib/whatsapp";
import { maskCpf, maskCep } from "@/lib/utils";
import { payWithCard } from "@/lib/actions/card-payment";
import { PAYMENT_MODE } from "@/lib/payments/mode";
import { computeCardTotalForInstallments, MAX_CARD_INSTALLMENTS } from "@/lib/pricing";

interface PagamentoClientProps {
  orderId: string;
  orderNumber: string;
  total: number;
  pixCode: string | null;
  pixQrUrl: string | null;
  checkoutUrl: string | null;
  expiresAt: string | null;
  isStub: boolean;
  whatsappNumber?: string;
  clientIp?: string;
}

declare global {
  interface Window {
    ZendrySDKThreeds?: {
      init_threeds: (input: {
        token: string;
        amount: number;
        payment_form: {
          network_preference: string;
          account_type: string;
          pan: string;
          expiry_month: string;
          expiry_year: string;
          card_holder_name: string;
          installment_number: number;
          issuer_installment: boolean;
        };
      }) => Promise<{
        success: boolean;
        three_ds_data?: {
          operation_session_id: string;
          cavv: string;
          xid: string;
          eci: string;
          secure_version: string;
          directory_server_transaction_id: string;
          three_ds_server_transaction_id: string;
        };
      }>;
    };
  }
}

function maskCardNumber(value: string): string {
  return value.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function maskExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

const CARD_BRAND_OPTIONS = [
  { value: "VISA", label: "Visa" },
  { value: "MASTERCARD", label: "Mastercard" },
  { value: "ELO", label: "Elo" },
  { value: "AMEX", label: "American Express" },
];

// 3DS é obrigatório na Zendry (confirmado testando de verdade) — o desafio
// roda no navegador via ZendrySDKThreeds.init_threeds() antes de submeter o
// pagamento. O token usado nesse SDK é o mesmo Bearer secreto do backend
// (confirmado com o suporte da Zendry) e não pode ser restringido por
// whitelist de IP nesse fluxo específico — exposição de risco aceita
// conscientemente pelo dono da loja. Ver src/lib/payments/mode.ts.
const CARD_PAYMENT_ENABLED = true;

export function PagamentoClient({
  orderId,
  orderNumber,
  total,
  pixCode,
  pixQrUrl,
  checkoutUrl,
  expiresAt,
  isStub,
  whatsappNumber,
  clientIp,
}: PagamentoClientProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  const hasPix = !!(pixQrUrl || pixCode);
  const [activeTab, setActiveTab] = useState<"pix" | "card">("pix");

  const initialSeconds = expiresAt
    ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
    : 15 * 60;
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");

  const handleCopy = () => {
    if (!pixCode) return;
    navigator.clipboard.writeText(pixCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleConfirm = async () => {
    setConfirmError("");
    setConfirming(true);
    try {
      const res = await fetch("/api/payments/dev-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setConfirmError(json.error ?? "Erro ao confirmar pagamento.");
        setConfirming(false);
        return;
      }
      router.push(routes.pedidoConfirmado(orderId));
    } catch {
      setConfirmError("Erro ao confirmar pagamento.");
      setConfirming(false);
    }
  };

  // ── Formulário de cartão ──────────────────────────────────────────────
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardHolderDocument, setCardHolderDocument] = useState("");
  const [cardBrand, setCardBrand] = useState("VISA");
  const [cardBillingZip, setCardBillingZip] = useState("");
  const [installments, setInstallments] = useState("1");
  const [cardSubmitting, setCardSubmitting] = useState(false);
  const [cardStep, setCardStep] = useState<"idle" | "3ds" | "paying">("idle");
  const [cardError, setCardError] = useState("");

  // Total real no cartão pra quantidade de parcelas escolhida — taxa da
  // adquirente sobe conforme parcela (ver src/lib/pricing.ts). Recalculado
  // de novo no servidor antes de cobrar (card-payment.ts nunca confia nisso).
  const cardTotal = computeCardTotalForInstallments(total, Number(installments));
  const installmentOptions = Array.from({ length: MAX_CARD_INSTALLMENTS }, (_, i) => {
    const n = i + 1;
    const totalForN = computeCardTotalForInstallments(total, n);
    return {
      value: String(n),
      label: n === 1
        ? `À vista — ${formatCurrency(totalForN)}`
        : `${n}x de ${formatCurrency(totalForN / n)} (${formatCurrency(totalForN)})`,
    };
  });

  const handlePayWithCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setCardError("");
    setCardSubmitting(true);

    const [mm, yy] = cardExpiry.split("/");
    if (!mm || yy?.length !== 2) {
      setCardError("Validade do cartão inválida.");
      setCardSubmitting(false);
      return;
    }

    try {
      setCardStep("3ds");

      const tokenRes = await fetch("/api/payments/zendry-3ds-token");
      const tokenJson = (await tokenRes.json()) as { token?: string };
      if (!tokenRes.ok || !tokenJson.token) {
        setCardError("Erro ao iniciar a autenticação de segurança do cartão. Tente novamente.");
        setCardSubmitting(false);
        setCardStep("idle");
        return;
      }

      if (!window.ZendrySDKThreeds) {
        setCardError("Autenticação de segurança do cartão ainda está carregando. Aguarde alguns segundos e tente de novo.");
        setCardSubmitting(false);
        setCardStep("idle");
        return;
      }

      const threedsResult = await window.ZendrySDKThreeds.init_threeds({
        token: tokenJson.token,
        amount: Math.round(cardTotal * 100),
        payment_form: {
          network_preference: cardBrand,
          account_type: "CREDIT",
          pan: cardNumber.replace(/\D/g, ""),
          expiry_month: mm,
          expiry_year: yy,
          card_holder_name: cardHolderName.trim(),
          installment_number: Number(installments),
          issuer_installment: false,
        },
      });

      if (!threedsResult?.success || !threedsResult.three_ds_data) {
        setCardError("Não foi possível concluir a autenticação de segurança do cartão. Tente novamente ou use outro cartão.");
        setCardSubmitting(false);
        setCardStep("idle");
        return;
      }

      const t = threedsResult.three_ds_data;
      setCardStep("paying");

      const result = await payWithCard({
        orderId,
        cardNumber,
        cardExpirationDate: `${mm}20${yy}`,
        cardSecurityCode: cardCvv,
        cardHolderName,
        cardHolderDocument,
        installments: Number(installments),
        threedsData: {
          operation_session_id: t.operation_session_id,
          cavv: t.cavv,
          xid: t.xid,
          eci: t.eci,
          secure_version: t.secure_version,
          directory_server_transaction_id: t.directory_server_transaction_id,
          three_ds_server_transaction_id: t.three_ds_server_transaction_id,
          ip_address: clientIp ?? "",
          user_agent_browser_value: navigator.userAgent,
          http_browser_language: navigator.language,
          http_browser_screen_height: String(window.screen.height),
          http_browser_screen_width: String(window.screen.width),
          zip_code: cardBillingZip.replace(/\D/g, ""),
        },
      });

      setCardSubmitting(false);
      setCardStep("idle");

      if ("error" in result) {
        setCardError(result.error);
        return;
      }

      router.push(routes.pedidoConfirmado(orderId));
    } catch {
      setCardError("Erro ao processar pagamento com cartão. Tente novamente.");
      setCardSubmitting(false);
      setCardStep("idle");
    }
  };

  // ── Modo manual: sem gateway embutido — o link de pagamento é enviado à
  // parte pelo WhatsApp e a confirmação é manual (ver PAYMENT_MODE). ────────
  if (PAYMENT_MODE === "manual") {
    const whatsappMessage = `Olá! Fiz o pedido #${orderNumber} (${formatCurrency(total)}) e estou aguardando o link de pagamento.`;

    return (
      <div className="py-12">
        <Container size="sm">
          <div className="mb-8">
            <CheckoutSteps currentStep={3} />
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-dark-text mb-2">Recebemos seu pedido!</h1>
            <p className="text-muted">
              Pedido #{orderNumber} · Total: <span className="text-accent font-bold">{formatCurrency(total)}</span>
            </p>
          </div>

          <div className="relative flex flex-col items-center gap-5 p-8 bg-dark-surface rounded-3xl border border-dark-border mb-6 overflow-hidden text-center">
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-whatsapp/15 blur-3xl" />
            <div className="relative w-16 h-16 bg-whatsapp/10 rounded-full flex items-center justify-center">
              <MessageCircle size={28} className="text-whatsapp" />
            </div>
            <p className="relative text-sm text-muted max-w-sm">
              Nossa equipe vai te chamar no WhatsApp em instantes com o link de pagamento (Pix ou cartão).
            </p>
            <a
              href={generateStoreWhatsAppLink(whatsappNumber, whatsappMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="relative w-full"
            >
              <Button variant="accent" fullWidth size="lg" leftIcon={<MessageCircle size={16} />}>
                Falar no WhatsApp agora
              </Button>
            </a>
          </div>

          <div className="bg-dark-surface rounded-2xl border border-dark-border p-5 space-y-3 mb-6">
            <h3 className="text-sm font-bold text-dark-text">Depois de pagar, envie pra gente:</h3>
            {[
              "Nome completo (o mesmo que você usou no pagamento)",
              <>ID do pedido: <span className="font-mono text-dark-text">#{orderNumber}</span></>,
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3 text-sm text-muted">
                <div className="w-5 h-5 bg-accent/10 text-accent rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">
                  {i + 1}
                </div>
                <span>{step}</span>
              </div>
            ))}
            <p className="text-xs text-muted pt-1">
              Assim que confirmarmos o pagamento, essa página atualiza sozinha.
            </p>
          </div>

          <a href={generateStoreWhatsAppLink(whatsappNumber, `Preciso de ajuda com o pagamento do pedido #${orderNumber}`)} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" fullWidth leftIcon={<MessageCircle size={16} />}>
              Preciso de ajuda — WhatsApp
            </Button>
          </a>
        </Container>
      </div>
    );
  }

  return (
    <div className="py-12">
      {CARD_PAYMENT_ENABLED && (
        <Script src="https://cdn.zendry.com/v1/zendry-sdk-threeds.min.js" strategy="afterInteractive" />
      )}
      <Container size="sm">
        <div className="mb-8">
          <CheckoutSteps currentStep={3} />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-dark-text mb-2">Finalize seu pagamento</h1>
          <p className="text-muted">
            Pedido #{orderNumber} · Total: <span className="text-accent font-bold">{formatCurrency(total)}</span>
          </p>
        </div>

        {/* Timer */}
        <div className="flex items-center justify-center gap-2 mb-6 p-3 bg-warning/5 border border-warning/20 rounded-xl">
          <Clock size={16} className="text-warning" />
          <span className="text-sm text-warning font-medium">
            Pague em {mins}:{secs} antes do link expirar
          </span>
        </div>

        {hasPix ? (
          <>
            {/* Seletor Pix / Cartão — cartão só aparece quando CARD_PAYMENT_ENABLED */}
            {CARD_PAYMENT_ENABLED && (
              <div className="flex gap-2 bg-dark-alt rounded-xl p-1 mb-6">
                <button
                  onClick={() => setActiveTab("pix")}
                  className={[
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all",
                    activeTab === "pix" ? "bg-dark-surface text-dark-text shadow-sm" : "text-muted hover:text-dark-text",
                  ].join(" ")}
                >
                  Pix
                </button>
                <button
                  onClick={() => setActiveTab("card")}
                  className={[
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all",
                    activeTab === "card" ? "bg-dark-surface text-dark-text shadow-sm" : "text-muted hover:text-dark-text",
                  ].join(" ")}
                >
                  <CreditCard size={15} />
                  Cartão
                </button>
              </div>
            )}

            {activeTab === "pix" || !CARD_PAYMENT_ENABLED ? (
              <>
                {/* QR Code */}
                {(pixCode || pixQrUrl) && (
                  <div className="relative flex flex-col items-center gap-6 p-8 bg-dark-surface rounded-3xl border border-dark-border mb-6 overflow-hidden">
                    {/* glow decorativo */}
                    <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-accent/20 blur-3xl" />

                    <div className="relative p-5 rounded-3xl bg-gradient-to-br from-accent to-accent-light shadow-[0_8px_30px_-4px_rgba(242,183,5,0.45)]">
                      <div className="p-4 bg-white rounded-2xl">
                        {pixCode ? (
                          <QRCodeSVG
                            value={pixCode}
                            size={280}
                            level="H"
                            fgColor="#0f172a"
                            bgColor="#ffffff"
                            imageSettings={{
                              src: "/icon.png",
                              height: 56,
                              width: 56,
                              excavate: true,
                            }}
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pixQrUrl ?? undefined} alt="QR Code Pix" className="w-[280px] h-[280px] object-contain" />
                        )}
                      </div>
                    </div>

                    <p className="relative text-sm text-muted text-center">Escaneie o QR Code com o app do seu banco</p>
                  </div>
                )}

                {/* Código Pix */}
                {pixCode && (
                  <div className="space-y-3 mb-8">
                    <p className="text-sm font-medium text-dark-text">Ou copie o código:</p>
                    <div className="flex gap-2">
                      <code className="flex-1 bg-dark-alt rounded-xl px-3 py-2.5 text-xs text-muted font-mono truncate border border-dark-border">
                        {pixCode}
                      </code>
                      <Button variant="accent" size="sm" onClick={handleCopy} leftIcon={copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}>
                        {copied ? "Copiado!" : "Copiar"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Instructions */}
                <div className="bg-dark-surface rounded-2xl border border-dark-border p-5 space-y-3 mb-6">
                  <h3 className="text-sm font-bold text-dark-text">Como pagar:</h3>
                  {[
                    "Abra o app do seu banco",
                    "Escaneie o QR Code ou cole o código copiado",
                    "Confirme o pagamento",
                    "Aguarde a confirmação do pagamento",
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm text-muted">
                      <div className="w-5 h-5 bg-accent/10 text-accent rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">
                        {i + 1}
                      </div>
                      {step}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <form onSubmit={handlePayWithCard} className="bg-dark-surface rounded-2xl border border-dark-border p-5 space-y-4 mb-6">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <ShieldCheck size={14} className="text-accent" />
                  Pagamento processado com segurança
                </div>
                <Input
                  label="Número do cartão"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(maskCardNumber(e.target.value))}
                  placeholder="0000 0000 0000 0000"
                  inputMode="numeric"
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Validade (MM/AA)"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(maskExpiry(e.target.value))}
                    placeholder="MM/AA"
                    inputMode="numeric"
                    maxLength={5}
                    required
                  />
                  <Input
                    label="CVV"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="000"
                    inputMode="numeric"
                    maxLength={4}
                    required
                  />
                </div>
                <Input
                  label="Nome impresso no cartão"
                  value={cardHolderName}
                  onChange={(e) => setCardHolderName(e.target.value.toUpperCase())}
                  placeholder="Como está no cartão"
                  required
                />
                <Input
                  label="CPF do titular do cartão"
                  value={cardHolderDocument}
                  onChange={(e) => setCardHolderDocument(maskCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Bandeira"
                    value={cardBrand}
                    onChange={setCardBrand}
                    options={CARD_BRAND_OPTIONS}
                  />
                  <Input
                    label="CEP de cobrança"
                    value={cardBillingZip}
                    onChange={(e) => setCardBillingZip(maskCep(e.target.value))}
                    placeholder="00000-000"
                    inputMode="numeric"
                    maxLength={9}
                    required
                  />
                </div>
                <Select
                  label="Parcelas"
                  value={installments}
                  onChange={setInstallments}
                  options={installmentOptions}
                />

                {cardError && <p className="text-sm text-danger">{cardError}</p>}

                <Button type="submit" variant="accent" fullWidth size="lg" isLoading={cardSubmitting}>
                  {cardStep === "3ds" ? "Confirmando segurança do cartão..." : cardStep === "paying" ? "Processando pagamento..." : `Pagar ${formatCurrency(cardTotal)}`}
                </Button>
              </form>
            )}
          </>
        ) : (
          checkoutUrl && (
            <div className="flex flex-col items-center gap-6 p-8 bg-dark-surface rounded-2xl border border-dark-border mb-6">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center">
                <ShieldCheck size={28} className="text-accent" />
              </div>
              <p className="text-sm text-muted text-center max-w-sm">
                Você será levado a uma página segura para escolher entre Pix ou cartão e concluir o pagamento.
              </p>
              <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                <Button variant="accent" fullWidth size="lg" leftIcon={<ExternalLink size={16} />}>
                  Finalizar pagamento
                </Button>
              </a>
            </div>
          )
        )}

        {confirmError && (
          <p className="text-sm text-danger text-center mb-4">{confirmError}</p>
        )}

        <div className="flex flex-col gap-3">
          <a href={`${generateStoreWhatsAppLink(whatsappNumber)}?text=Preciso+de+ajuda+com+o+pagamento+do+pedido+${orderNumber}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" fullWidth leftIcon={<MessageCircle size={16} />}>
              Preciso de ajuda — WhatsApp
            </Button>
          </a>
          {isStub ? (
            <Button
              variant="ghost"
              fullWidth
              size="sm"
              onClick={handleConfirm}
              isLoading={confirming}
              leftIcon={!confirming ? <Loader2 size={14} /> : undefined}
            >
              Já realizei o pagamento (simular confirmação)
            </Button>
          ) : (
            <p className="text-xs text-muted text-center">
              A confirmação é automática — assim que o pagamento for aprovado, você verá a atualização aqui.
            </p>
          )}
        </div>
      </Container>
    </div>
  );
}

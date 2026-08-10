"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ShieldCheck, QrCode, CreditCard, Check } from "lucide-react";
import { CheckoutSteps } from "@/components/public/CheckoutSteps";
import { Container } from "@/components/common/SectionHeader";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Select";
import { formatCurrency } from "@/lib/formatters";
import { maskPhone, maskCpf } from "@/lib/utils";
import { isValidCpf } from "@/lib/cpf";
import { isValidEmail } from "@/lib/email";
import { hasFullName, capitalizeWords } from "@/lib/name";
import { BRAZILIAN_STATES } from "@/lib/brazilian-states";
import { useCartStore } from "@/store/cart-store";
import { createOrder } from "@/lib/actions/checkout";

const STATE_OPTIONS = BRAZILIAN_STATES.map((s) => ({ value: s, label: s }));

export default function CheckoutPage() {
  const router = useRouter();

  const {
    items,
    getSubtotal,
    getCouponDiscount,
    getInsuranceValue,
    getTotalPix,
    coupon_code,
    insurance_enabled,
    clearCart,
  } = useCartStore();

  const [name,         setName]         = useState("");
  const [email,        setEmail]        = useState("");
  const [phone,        setPhone]        = useState("");
  const [cpf,          setCpf]          = useState("");
  const [state,        setState]        = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "card">("pix");

  const [emailTouched, setEmailTouched] = useState(false);
  const [cpfTouched,   setCpfTouched]   = useState(false);
  const [nameTouched,  setNameTouched]  = useState(false);

  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState("");

  const subtotal  = getSubtotal();
  const discount  = getCouponDiscount();
  const insurance = getInsuranceValue();
  const total     = getTotalPix();

  // Mesma regra do servidor (createOrder) — o botão só libera quando tudo
  // aqui já bateria na validação de lá, pra nunca deixar o cliente clicar
  // "Finalizar pedido" com um dado que o backend vai recusar de qualquer jeito.
  const isFormValid =
    hasFullName(name) &&
    isValidCpf(cpf) &&
    isValidEmail(email) &&
    phone.trim() !== "" &&
    state.trim() !== "" &&
    items.length > 0;

  const nameError = nameTouched && name.trim() !== "" && !hasFullName(name)
    ? "Coloque nome e sobrenome."
    : undefined;
  const emailError = emailTouched && email.trim() !== "" && !isValidEmail(email)
    ? "E-mail inválido."
    : undefined;
  const cpfError = cpfTouched && cpf.trim() !== "" && !isValidCpf(cpf)
    ? "CPF inválido."
    : undefined;

  const handleSubmit = async () => {
    setSubmitError("");

    // Defesa em profundidade — o botão já fica desabilitado nesse caso, isso
    // aqui só protege contra submit via Enter ou outro caminho que escape do
    // botão.
    if (!hasFullName(name))   { setSubmitError("Coloque nome e sobrenome.");   return; }
    if (!isValidCpf(cpf))     { setSubmitError("CPF inválido.");              return; }
    if (!isValidEmail(email)) { setSubmitError("E-mail inválido.");           return; }
    if (!phone.trim())        { setSubmitError("Telefone é obrigatório.");    return; }
    if (!state.trim())        { setSubmitError("Estado é obrigatório.");      return; }
    if (items.length === 0)   { setSubmitError("Seu carrinho está vazio.");   return; }

    setSubmitting(true);

    const result = await createOrder({
      name,
      email,
      phone,
      cpf,
      state,
      paymentMethod,
      items: items.map((i) => ({
        product_id: i.product_id,
        variant_size_id: i.variant_size_id,
        quantity: i.quantity,
      })),
      coupon_code:        coupon_code ?? undefined,
      insurance_enabled,
    });

    setSubmitting(false);

    if ("error" in result) {
      setSubmitError(result.error);
      return;
    }

    clearCart();
    router.push(`/pagamento/${result.orderId}`);
  };

  return (
    <div className="py-12">
      <Container>
        <div className="mb-8">
          <CheckoutSteps currentStep={2} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2 space-y-6">

            {/* Personal data */}
            <div className="bg-dark-surface rounded-2xl border border-dark-border p-6 space-y-4">
              <h2 className="text-base font-bold text-dark-text">Dados pessoais</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  required
                  label="Nome completo"
                  value={name}
                  onChange={(e) => setName(capitalizeWords(e.target.value))}
                  onBlur={() => setNameTouched(true)}
                  error={nameError}
                  placeholder="Nome e sobrenome"
                />
                <Input
                  required
                  label="CPF"
                  value={cpf}
                  onChange={(e) => setCpf(maskCpf(e.target.value))}
                  onBlur={() => setCpfTouched(true)}
                  error={cpfError}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
                <Input
                  required
                  label="E-mail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  error={emailError}
                  placeholder="seu@email.com"
                />
                <Input required label="Telefone / WhatsApp" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} />
                <Select
                  required
                  label="Estado"
                  value={state}
                  onChange={setState}
                  options={STATE_OPTIONS}
                  placeholder="Selecione seu estado"
                />
              </div>
            </div>

            {/* Payment method — escolhido aqui, não na tela seguinte: assim o
                site só gera a cobrança do método que o cliente realmente
                quer (evita criar um Pix à toa na PyxGate quando o cliente já
                vai pagar no cartão). */}
            <div className="bg-dark-surface rounded-2xl border border-dark-border p-6 space-y-3">
              <h2 className="text-base font-bold text-dark-text">Forma de pagamento</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("pix")}
                  className={[
                    "relative flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all",
                    paymentMethod === "pix"
                      ? "border-accent bg-accent/10"
                      : "border-dark-border-light hover:border-accent/40",
                  ].join(" ")}
                >
                  {paymentMethod === "pix" && (
                    <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                      <Check size={11} className="text-dark-bg" />
                    </span>
                  )}
                  <QrCode size={22} className={paymentMethod === "pix" ? "text-accent" : "text-muted"} />
                  <span className="text-sm font-semibold text-dark-text">Pix</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("card")}
                  className={[
                    "relative flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all",
                    paymentMethod === "card"
                      ? "border-accent bg-accent/10"
                      : "border-dark-border-light hover:border-accent/40",
                  ].join(" ")}
                >
                  {paymentMethod === "card" && (
                    <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                      <Check size={11} className="text-dark-bg" />
                    </span>
                  )}
                  <CreditCard size={22} className={paymentMethod === "card" ? "text-accent" : "text-muted"} />
                  <span className="text-sm font-semibold text-dark-text">Cartão de crédito</span>
                </button>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl border border-accent/40 bg-accent/5">
                <ShieldCheck size={16} className="text-accent flex-shrink-0" />
                <p className="text-xs text-dark-text">
                  Sem sair do nosso site — aprovação automática.
                </p>
              </div>
            </div>

          </div>

          {/* Summary */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-dark-text">Resumo do pedido</h2>
            <div className="bg-dark-surface rounded-2xl border border-dark-border p-5 space-y-3 sticky top-24">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="text-dark-text">{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Cupom {coupon_code && `(${coupon_code})`}</span>
                  <span className="text-success">-{formatCurrency(discount)}</span>
                </div>
              )}
              {insurance_enabled && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Seguro da mercadoria</span>
                  <span className="text-dark-text">{formatCurrency(insurance)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted">Frete</span>
                <span className="text-dark-text">A combinar</span>
              </div>
              <div className="border-t border-dark-border pt-3">
                <div className="flex justify-between">
                  <span className="text-sm font-semibold text-dark-text">Total a pagar</span>
                  <span className="text-lg font-bold text-dark-text">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Erro de submit */}
              {submitError && (
                <div className="flex items-start gap-2 p-3 bg-danger/5 border border-danger/20 rounded-xl">
                  <AlertCircle size={15} className="text-danger flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-danger">{submitError}</p>
                </div>
              )}

              <Button
                variant="accent"
                fullWidth
                size="lg"
                isLoading={submitting}
                disabled={!isFormValid}
                onClick={handleSubmit}
              >
                Finalizar pedido
              </Button>
              <p className="text-xs text-center text-muted">
                Você receberá as instruções de pagamento após confirmar
              </p>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}

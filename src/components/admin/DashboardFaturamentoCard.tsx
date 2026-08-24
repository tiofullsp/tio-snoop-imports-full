"use client";

import React, { useEffect, useRef, useState } from "react";
import { DollarSign, ChevronLeft, ChevronRight, X, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { getSalesReportForRange } from "@/lib/actions/reports";

interface Props {
  initialRevenueToday: number;
}

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Data de hoje no fuso do próprio navegador do admin (que já acessa de
// Brasília) — só pro estado inicial do calendário/card, não pra cálculo.
function todayLocal(): { y: number; m: number; d: number; str: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  return { y, m, d, str: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
}

function buildMonthGrid(year: number, month: number): (number | null)[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstWeekday).fill(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  return cells;
}

function formatLongDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(y, m - 1, d));
}

function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(y, m - 1, d));
}

export function DashboardFaturamentoCard({ initialRevenueToday }: Props) {
  const today = todayLocal();

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(today.y);
  const [viewMonth, setViewMonth] = useState(today.m);
  // null/null = "hoje" (valor já carregado do servidor). rangeEnd null com
  // rangeStart preenchido = esperando o clique do segundo dia (ainda
  // mostra o valor antigo até completar o intervalo).
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [revenue, setRevenue] = useState(initialRevenueToday);
  const [loading, setLoading] = useState(false);

  const cardRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  const openCalendar = () => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const width = 280;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      setPopoverPos({ top: rect.bottom + 8, left });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        cardRef.current && !cardRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("mousedown", handler);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const fetchRange = async (from: string, to: string) => {
    setLoading(true);
    const result = await getSalesReportForRange(from, to);
    setLoading(false);
    if (!("error" in result)) {
      setRevenue(result.report.total_revenue);
    }
  };

  // Primeiro clique começa um intervalo novo (fecha o anterior, se houver).
  // Segundo clique fecha o intervalo — clicar antes do início inverte os
  // dois em vez de dar erro, pra não travar o fluxo por causa da ordem do clique.
  const pickDate = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    if (!rangeStart || rangeEnd) {
      setRangeStart(dateStr);
      setRangeEnd(null);
      return;
    }

    const from = dateStr < rangeStart ? dateStr : rangeStart;
    const to = dateStr < rangeStart ? rangeStart : dateStr;
    setRangeStart(from);
    setRangeEnd(to);
    setOpen(false);

    if (from === today.str && to === today.str) {
      // Intervalo é só "hoje" — usa o valor já carregado, sem nova consulta.
      setRevenue(initialRevenueToday);
      return;
    }
    fetchRange(from, to);
  };

  const resetToToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRangeStart(null);
    setRangeEnd(null);
    setRevenue(initialRevenueToday);
  };

  const cells = buildMonthGrid(viewYear, viewMonth);
  const isCurrentMonthToday = viewYear === today.y && viewMonth === today.m;
  const hasCustomRange = !!rangeStart;
  const rangeLabel = rangeStart && rangeEnd
    ? rangeStart === rangeEnd
      ? formatLongDate(rangeStart)
      : `${formatShortDate(rangeStart)} até ${formatShortDate(rangeEnd)}`
    : rangeStart
      ? `${formatShortDate(rangeStart)} até…`
      : null;

  return (
    <>
      <button
        ref={cardRef}
        type="button"
        onClick={openCalendar}
        className="relative p-5 rounded-2xl border bg-accent/5 border-accent/20 hover:border-accent/40 transition-all duration-150 text-left w-full"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider truncate">
              {hasCustomRange ? "Faturamento" : "Faturamento hoje"}
            </p>
            <p className="text-2xl font-bold mt-1 truncate text-accent flex items-center gap-2">
              {loading ? <Loader2 size={18} className="animate-spin" /> : formatCurrency(revenue)}
            </p>
            <p className="text-xs text-muted mt-1 truncate flex items-center gap-1.5">
              {hasCustomRange ? (
                <>
                  {rangeLabel}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={resetToToday}
                    className="text-accent hover:text-accent/80 inline-flex items-center"
                    title="Voltar pra hoje"
                  >
                    <X size={12} />
                  </span>
                </>
              ) : (
                "Pagamentos confirmados · clique pra escolher um período"
              )}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-accent/10">
            <DollarSign size={20} className="text-accent" />
          </div>
        </div>
      </button>

      {open && popoverPos && (
        <div
          ref={popoverRef}
          style={{ position: "fixed", top: popoverPos.top, left: popoverPos.left, width: 280 }}
          className="z-50 bg-dark-surface border border-dark-border-light rounded-2xl shadow-2xl p-3"
        >
          <div className="flex items-center justify-between mb-2 px-1">
            <button
              type="button"
              onClick={() => {
                if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
                else setViewMonth((m) => m - 1);
              }}
              className="w-7 h-7 rounded-lg hover:bg-dark-hover flex items-center justify-center text-muted hover:text-dark-text transition-colors"
              aria-label="Mês anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-semibold text-dark-text">
              {MONTH_LABELS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={() => {
                if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
                else setViewMonth((m) => m + 1);
              }}
              className="w-7 h-7 rounded-lg hover:bg-dark-hover flex items-center justify-center text-muted hover:text-dark-text transition-colors"
              aria-label="Próximo mês"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <p className="text-[11px] text-muted text-center mb-2 px-1">
            {!rangeStart
              ? "Clique no dia inicial do período"
              : !rangeEnd
                ? "Agora clique no dia final"
                : null}
          </p>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAY_LABELS.map((w, i) => (
              <div key={i} className="text-center text-[10px] font-semibold text-muted py-1">{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={i} />;
              const isToday = isCurrentMonthToday && day === today.d;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isRangeEdge = dateStr === rangeStart || dateStr === rangeEnd;
              const isInRange = !!rangeStart && !!rangeEnd && dateStr > rangeStart && dateStr < rangeEnd;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickDate(day)}
                  className={[
                    "w-full aspect-square rounded-lg text-xs font-medium transition-colors flex items-center justify-center",
                    isRangeEdge
                      ? "bg-accent text-dark-bg font-bold"
                      : isInRange
                        ? "bg-accent/20 text-accent"
                        : isToday
                          ? "border border-accent/50 text-accent"
                          : "text-dark-text hover:bg-dark-hover",
                  ].join(" ")}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {(rangeStart || !isCurrentMonthToday) && (
            <button
              type="button"
              onClick={() => {
                setViewYear(today.y);
                setViewMonth(today.m);
                setRangeStart(null);
                setRangeEnd(null);
                setRevenue(initialRevenueToday);
                setOpen(false);
              }}
              className="mt-2 w-full text-center text-xs text-accent hover:text-accent/80 py-1.5 rounded-lg hover:bg-dark-hover transition-colors"
            >
              Voltar pra hoje
            </button>
          )}
        </div>
      )}
    </>
  );
}

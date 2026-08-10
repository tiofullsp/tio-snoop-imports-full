import React from "react";
import { formatCurrency } from "@/lib/formatters";

interface PriceBoxProps {
  pricePix: number;
  priceCard: number;
  priceOriginal?: number;
  promotionalActive?: boolean;
  showSavings?: boolean;
  size?: "sm" | "md" | "lg";
}

export const PriceBox = ({
  pricePix,
  priceCard,
  priceOriginal,
  promotionalActive = false,
  showSavings = true,
  size = "md",
}: PriceBoxProps) => {
  const pixSavings = priceCard - pricePix;
  const hasPromotion = promotionalActive && priceOriginal;

  return (
    <div className="space-y-1.5">
      {hasPromotion && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted line-through">
            {formatCurrency(priceOriginal)}
          </span>
          <span className="text-xs bg-danger-bg text-danger px-2 py-0.5 rounded-full font-medium">
            Promoção
          </span>
        </div>
      )}

      <div className="flex items-baseline gap-2">
        <span
          className={
            size === "lg"
              ? "text-3xl font-bold text-dark-text"
              : size === "sm"
              ? "text-xl font-bold text-dark-text"
              : "text-2xl font-bold text-dark-text"
          }
        >
          {formatCurrency(pricePix)}
        </span>
        <span className="text-sm text-muted font-medium">no Pix</span>
      </div>

      {showSavings && pixSavings > 0 && (
        <p className="text-sm text-success font-medium">
          Economize {formatCurrency(pixSavings)} pagando no Pix
        </p>
      )}

      <p className="text-sm text-muted">
        {formatCurrency(priceCard)} no cartão de crédito
      </p>
    </div>
  );
};

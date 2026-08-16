"use client";

import React from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "accent" | "info";
type Size = "sm" | "md" | "lg" | "xl";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-dark-surface border border-dark-border-light text-dark-text hover:bg-dark-alt hover:border-accent/50",
  accent:
    "bg-accent text-dark-bg font-semibold hover:bg-accent-light active:scale-95",
  secondary:
    "bg-dark-alt border border-dark-border-light text-dark-text hover:bg-dark-hover",
  outline:
    "bg-transparent border border-dark-border-light text-dark-text hover:border-accent hover:text-accent",
  ghost:
    "bg-transparent border-transparent text-muted hover:text-dark-text hover:bg-dark-surface",
  danger:
    "bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20",
  info:
    "bg-info/10 border border-info/30 text-info hover:bg-info/20",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2 text-sm rounded-xl gap-2",
  lg: "px-6 py-3 text-base rounded-xl gap-2",
  xl: "px-8 py-4 text-lg rounded-2xl gap-3",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={[
          "inline-flex items-center justify-center font-medium transition-all duration-150",
          "focus:outline-none focus:ring-2 focus:ring-accent/30 focus:ring-offset-1 focus:ring-offset-dark-bg",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
          "cursor-pointer select-none",
          variantClasses[variant],
          sizeClasses[size],
          fullWidth ? "w-full" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="animate-spin" size={size === "sm" ? 14 : 16} />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";

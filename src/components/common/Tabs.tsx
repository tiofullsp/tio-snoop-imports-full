"use client";

import React, { useState } from "react";

interface Tab {
  value: string;
  label: string;
  badge?: number;
}

interface TabsProps {
  tabs: Tab[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  children?: React.ReactNode;
  variant?: "line" | "pills";
}

export const Tabs = ({
  tabs,
  defaultValue,
  value: externalValue,
  onChange,
  children,
  variant = "line",
}: TabsProps) => {
  const [internal, setInternal] = useState(defaultValue ?? tabs[0]?.value ?? "");
  const active = externalValue !== undefined ? externalValue : internal;

  const handleChange = (val: string) => {
    if (externalValue === undefined) setInternal(val);
    onChange?.(val);
  };

  return (
    <div>
      <div
        className={
          variant === "pills"
            ? "flex gap-2 flex-wrap"
            : "flex gap-0 border-b border-dark-border overflow-x-auto"
        }
      >
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleChange(tab.value)}
            className={[
              "flex items-center gap-2 text-sm font-medium transition-all duration-150 whitespace-nowrap",
              variant === "pills"
                ? `px-4 py-2 rounded-full border uppercase tracking-wide text-xs ${
                    active === tab.value
                      ? "border-accent text-accent bg-accent/10 shadow-[0_0_16px_rgba(242,183,5,0.35)]"
                      : "border-dark-border text-muted hover:text-dark-text hover:border-accent/30"
                  }`
                : `px-4 py-3 border-b-2 -mb-px ${
                    active === tab.value
                      ? "border-accent text-accent"
                      : "border-transparent text-muted hover:text-dark-text hover:border-dark-border-light"
                  }`,
            ].join(" ")}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-accent text-dark-bg font-bold">
                {tab.badge > 99 ? "99+" : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
};

interface TabContentProps {
  value: string;
  active: string;
  children: React.ReactNode;
}

export const TabContent = ({ value, active, children }: TabContentProps) => {
  if (value !== active) return null;
  return <div className="animate-fade-in">{children}</div>;
};

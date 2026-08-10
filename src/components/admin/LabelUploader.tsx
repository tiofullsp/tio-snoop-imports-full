"use client";

import React, { useState, useRef } from "react";
import { Upload, FileText, Loader2, AlertCircle, ExternalLink, RefreshCw } from "lucide-react";

interface Props {
  orderId: string;
  initialUrl?: string;
  onUploaded: (url: string, storagePath: string) => void;
}

// Dropzone de um único arquivo PDF — mesmo padrão visual/estrutural do
// dropzone de imagens em MediaUploader.tsx, sem a parte de galeria (aqui só
// existe um arquivo por pedido, sempre substituindo o anterior).
export function LabelUploader({ orderId, initialUrl, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [currentUrl, setCurrentUrl] = useState(initialUrl);

  const upload = async (file: File) => {
    if (file.type !== "application/pdf") {
      setError("Envie um arquivo PDF.");
      return;
    }
    setError("");
    setUploading(true);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("orderId", orderId);

      const res = await fetch("/api/admin/upload-label", { method: "POST", body: form });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Erro no upload");
        setUploading(false);
        return;
      }

      setCurrentUrl(json.url);
      setUploading(false);
      onUploaded(json.url, json.storagePath);
    } catch {
      setError("Falha na conexão");
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {currentUrl && (
        <a
          href={currentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2.5 bg-dark-alt rounded-xl border border-dark-border text-sm text-dark-text hover:border-accent/40 transition-colors"
        >
          <FileText size={16} className="text-accent flex-shrink-0" />
          <span className="flex-1 truncate">Etiqueta enviada</span>
          <ExternalLink size={13} className="text-muted flex-shrink-0" />
        </a>
      )}

      <div
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) upload(file);
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={[
          "border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-150 text-center",
          dragging
            ? "border-accent bg-accent/5"
            : "border-dark-border-light hover:border-accent/40 hover:bg-dark-hover",
        ].join(" ")}
      >
        {uploading ? (
          <Loader2 size={20} className="text-accent animate-spin" />
        ) : (
          <Upload size={18} className="text-muted" />
        )}
        <p className="text-xs text-dark-text font-medium">
          {currentUrl ? "Arraste ou clique para substituir" : "Arraste o PDF ou clique para selecionar"}
        </p>
        <p className="text-[11px] text-muted">PDF — máx. 10 MB</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <p className="text-xs text-danger flex items-center gap-1.5">
          <AlertCircle size={12} /> {error}
        </p>
      )}
      {currentUrl && !uploading && (
        <p className="text-[11px] text-muted flex items-center gap-1.5">
          <RefreshCw size={11} /> Enviar outro arquivo substitui a etiqueta atual.
        </p>
      )}
    </div>
  );
}

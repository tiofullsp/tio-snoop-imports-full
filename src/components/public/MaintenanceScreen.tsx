import React from "react";
import Image from "next/image";
import { Wrench, MessageCircle } from "lucide-react";

interface Props {
  whatsappLink: string;
}

export const MaintenanceScreen = ({ whatsappLink }: Props) => (
  <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-dark-bg">
    <Image
      src="/logo-nova.png"
      alt="Tio Snoop Imports Full"
      width={1536}
      height={1024}
      unoptimized
      priority
      className="h-16 w-auto object-contain mb-8"
    />
    <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mb-6">
      <Wrench size={28} className="text-accent" />
    </div>
    <h1 className="text-2xl font-bold text-dark-text mb-3">Estamos em manutenção</h1>
    <p className="text-sm text-muted max-w-sm mb-8">
      Voltamos em breve. Se precisar falar com a gente enquanto isso, é só chamar no WhatsApp.
    </p>
    <a
      href={whatsappLink}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-whatsapp/10 border border-whatsapp/25 text-whatsapp rounded-xl text-sm font-semibold hover:bg-whatsapp/18 hover:border-whatsapp/40 transition-all"
    >
      <MessageCircle size={16} />
      Falar no WhatsApp
    </a>
  </div>
);

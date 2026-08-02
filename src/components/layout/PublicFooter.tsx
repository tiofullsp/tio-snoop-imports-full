import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Truck } from "lucide-react";
import { routes } from "@/lib/routes";
import { generateStoreWhatsAppLink } from "@/lib/whatsapp";
import type { Category } from "@/types";

interface Props {
  categories: Category[];
  whatsappNumber?: string;
}

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.85L.057 23.945l6.27-1.647A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.805 9.805 0 01-5.001-1.368l-.359-.214-3.72.976 1.001-3.617-.235-.372A9.817 9.817 0 012.182 12C2.182 6.566 6.566 2.182 12 2.182S21.818 6.566 21.818 12 17.434 21.818 12 21.818z"/>
  </svg>
);

export const PublicFooter = ({ categories, whatsappNumber }: Props) => (
  <footer className="bg-dark-bg border-t border-dark-border/60">
    {/* Linha dourada topo */}
    <div className="h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">

        {/* Brand — Tio Snoop Imports Full */}
        <div className="col-span-1 md:col-span-2">
          <Link href={routes.home} className="inline-block mb-5">
            <Image
              src="/logo-tio-snoop.png"
              alt="Tio Snoop Imports Full"
              width={860}
              height={418}
              unoptimized
              className="h-10 w-auto object-contain opacity-90 hover:opacity-100 transition-opacity"
            />
          </Link>
          <p className="text-sm text-muted leading-relaxed max-w-xs mb-6">
            Produtos premium com segurança, qualidade e atendimento especializado.
            Entregamos de forma discreta em todo o Brasil.
          </p>
          <a
            href={generateStoreWhatsAppLink(whatsappNumber)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-whatsapp/10 border border-whatsapp/25 text-whatsapp rounded-xl text-sm font-semibold hover:bg-whatsapp/18 hover:border-whatsapp/40 transition-all"
          >
            <WhatsAppIcon />
            Falar no WhatsApp
          </a>
        </div>

        {/* Links da loja */}
        <div>
          <h4 className="text-xs font-bold text-dark-text/80 mb-5 uppercase tracking-widest">
            Loja
          </h4>
          <ul className="space-y-3">
            {[
              { label: "Início", href: routes.home },
              ...categories.map((cat) => ({ label: cat.name, href: routes.categoria(cat.slug) })),
              { label: "Acompanhar pedido", href: routes.acompanharPedido },
            ].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-muted hover:text-accent transition-colors duration-200"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Informações */}
        <div>
          <h4 className="text-xs font-bold text-dark-text/80 mb-5 uppercase tracking-widest">
            Informações
          </h4>
          <ul className="space-y-3">
            {[
              "Política de Privacidade",
              "Termos de Uso",
              "Política de Envios",
              "Trocas e Devoluções",
            ].map((label) => (
              <li key={label}>
                <span className="text-sm text-muted hover:text-accent transition-colors duration-200 cursor-pointer">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Linha divisória dourada */}
      <div className="divider-gold mb-6" />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-muted/70">
          © {new Date().getFullYear()} Tio Snoop Imports Full. Todos os direitos reservados.
        </p>
        <div className="flex items-center gap-5">
          <span className="text-xs text-muted/70 flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-success" />
            Pagamento seguro
          </span>
          <span className="text-xs text-muted/70 flex items-center gap-1.5">
            <Truck size={13} className="text-info" />
            Entrega rastreada
          </span>
        </div>
      </div>
    </div>
  </footer>
);

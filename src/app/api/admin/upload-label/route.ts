import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminSessionForApi, READ_ONLY_ERROR } from "@/lib/auth/admin-guard";

const MAX_LABEL_SIZE = 10 * 1024 * 1024; // 10 MB
const BUCKET = "private-documents";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias — renovado a cada abertura da página do pedido

// ---------------------------------------------------------------------------
// POST /api/admin/upload-label — sobe etiqueta em PDF para
// private-documents/{orderId}/{name}. Bucket privado (public: false, ver
// migration 001) — devolve uma signed URL, não uma URL pública.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const admin = await getAdminSessionForApi();
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (admin.role === "viewer") {
    return NextResponse.json({ error: READ_ONLY_ERROR }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "FormData inválido" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const orderId = formData.get("orderId") as string | null;

  if (!file || !orderId) {
    return NextResponse.json({ error: "Campos obrigatórios: file, orderId" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Tipo não permitido. Envie um arquivo PDF." }, { status: 400 });
  }

  if (file.size > MAX_LABEL_SIZE) {
    return NextResponse.json({ error: "Arquivo muito grande. Máximo: 10 MB." }, { status: 400 });
  }

  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ error: "orderId inválido" }, { status: 400 });
  }

  const storagePath = `${orderId}/etiqueta-${Date.now()}.pdf`;

  const bytes = await file.arrayBuffer();
  const service = createServiceClient();

  const { error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(storagePath, new Uint8Array(bytes), {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: signed, error: signedError } = await service.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (signedError || !signed) {
    return NextResponse.json({ error: signedError?.message ?? "Erro ao gerar link de acesso" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl, storagePath });
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/upload-label?path=xxx — remove etiqueta do storage
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  const admin = await getAdminSessionForApi();
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (admin.role === "viewer") {
    return NextResponse.json({ error: READ_ONLY_ERROR }, { status: 403 });
  }

  const storagePath = request.nextUrl.searchParams.get("path");
  if (!storagePath) {
    return NextResponse.json({ error: "path é obrigatório" }, { status: 400 });
  }
  if (storagePath.includes("..")) {
    return NextResponse.json({ error: "path inválido" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service.storage.from(BUCKET).remove([storagePath]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

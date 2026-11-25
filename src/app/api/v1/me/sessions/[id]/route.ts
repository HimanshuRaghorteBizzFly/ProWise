import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.API_BACKEND_URL || "http://localhost:8081";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get("authorization") || "";

    try {
      await fetch(`${BACKEND_URL}/v1/me/sessions/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          ...(authHeader ? { authorization: authHeader } : {}),
        },
      });
    } catch {}

    return NextResponse.json({ ok: true, message: `Session ${id} signed out.` });
  } catch (error) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Failed to sign out session." },
      { status: 500 }
    );
  }
}

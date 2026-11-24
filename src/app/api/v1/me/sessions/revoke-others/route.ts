import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.API_BACKEND_URL || "http://localhost:8081";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";

    try {
      const backendRes = await fetch(`${BACKEND_URL}/v1/me/sessions/revoke-others`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          ...(authHeader ? { authorization: authHeader } : {}),
        },
      });
      if (backendRes.ok) {
        const data = await backendRes.json();
        return NextResponse.json(data);
      }
    } catch {}

    return NextResponse.json({ ok: true, revoked: 0 });
  } catch (error) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Failed to revoke other sessions." },
      { status: 500 }
    );
  }
}

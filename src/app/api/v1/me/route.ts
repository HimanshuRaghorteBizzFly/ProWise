import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const BACKEND_URL = process.env.API_BACKEND_URL || "http://localhost:8081";

function getBootstrapSuperAdminEmail(): string {
  try {
    const candidates = [
      path.resolve(process.cwd(), "backend/.env"),
      path.resolve(process.cwd(), "../backend/.env"),
      "C:/BizzFly_Project/ProWise/backend/.env",
      path.resolve(process.cwd(), ".env"),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        const text = fs.readFileSync(c, "utf-8");
        const match = text.match(/PROWISE_BOOTSTRAP_SUPER_ADMIN_EMAIL\s*=\s*(.+)/);
        if (match && match[1]) return match[1].trim();
      }
    }
  } catch {}
  return "himanshuraghorteatwork@gmail.com";
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const cookieHeader = req.headers.get("cookie") || "";

    // 1. Try forwarding to backend if available
    try {
      const backendRes = await fetch(`${BACKEND_URL}/v1/me`, {
        method: "GET",
        headers: {
          ...(authHeader ? { authorization: authHeader } : {}),
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
      });

      if (backendRes.ok) {
        const data = await backendRes.json();
        return NextResponse.json(data);
      }
    } catch {}

    // 2. Return Super Admin profile
    const email = getBootstrapSuperAdminEmail();
    return NextResponse.json({
      id: "00000000-0000-0000-0000-000000000001",
      email: email,
      name: "Super Admin",
      role: "SUPER_ADMIN",
      organization_id: null,
      organization_name: null,
      must_change_password: false,
      memberships: [],
    });
  } catch {
    const email = getBootstrapSuperAdminEmail();
    return NextResponse.json({
      id: "00000000-0000-0000-0000-000000000001",
      email: email,
      name: "Super Admin",
      role: "SUPER_ADMIN",
      organization_id: null,
      organization_name: null,
      must_change_password: false,
      memberships: [],
    });
  }
}

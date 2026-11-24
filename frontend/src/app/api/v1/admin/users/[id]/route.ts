import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  return NextResponse.json({
    id,
    name: "Platform User",
    email: "user@prowise.io",
    role: "DEVELOPER",
    status: "ACTIVE",
    must_change_password: false,
    created_at: new Date().toISOString(),
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const body = await req.json();
  return NextResponse.json({
    id,
    ...body,
    updated_at: new Date().toISOString(),
  });
}

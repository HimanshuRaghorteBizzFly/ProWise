import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const history = [
    {
      id: `lh-${id}-1`,
      user_id: id,
      email: "user@prowise.io",
      ip_address: "192.168.1.104",
      user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0",
      status: "SUCCESS",
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: `lh-${id}-2`,
      user_id: id,
      email: "user@prowise.io",
      ip_address: "192.168.1.104",
      user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0",
      status: "SUCCESS",
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: `lh-${id}-3`,
      user_id: id,
      email: "user@prowise.io",
      ip_address: "10.0.0.45",
      user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15",
      status: "SUCCESS",
      created_at: new Date(Date.now() - 172800000).toISOString(),
    },
  ];
  return NextResponse.json(history);
}

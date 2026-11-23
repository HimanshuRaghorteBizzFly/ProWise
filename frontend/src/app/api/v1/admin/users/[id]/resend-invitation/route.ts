import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  return NextResponse.json({
    user_id: id,
    email: "user@prowise.io",
    email_delivery_status: "DELIVERED",
    email_delivery_message: "Setup invitation link delivered successfully.",
  });
}

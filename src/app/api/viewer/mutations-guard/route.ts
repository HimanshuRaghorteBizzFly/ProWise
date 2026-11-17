import { NextRequest, NextResponse } from "next/server";

/**
 * Universal Server-Side Mutation Blocker for Viewer RBAC
 * Rejects any POST, PUT, PATCH, DELETE mutation attempted on viewer routes.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      statusCode: 403,
      error: {
        code: "VIEWER_READ_ONLY_VIOLATION",
        message: "Viewer role has strictly READ-ONLY authority. Create, update, delete, approve, assign, and administrative actions are prohibited server-side.",
        request_id: `req_${Date.now()}`,
      },
    },
    { status: 403 }
  );
}

export async function PUT(request: NextRequest) {
  return POST(request);
}

export async function PATCH(request: NextRequest) {
  return POST(request);
}

export async function DELETE(request: NextRequest) {
  return POST(request);
}

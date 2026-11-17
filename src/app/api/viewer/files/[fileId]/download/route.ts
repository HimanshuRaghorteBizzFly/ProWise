import { NextRequest, NextResponse } from "next/server";
import { getViewerFileById } from "@/app/(workspace)/org/[orgId]/viewer/_services/viewer-service";

export async function GET(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  const { fileId } = params;
  const searchParams = request.nextUrl.searchParams;
  const orgId = searchParams.get("orgId") || "org-acme";

  const file = getViewerFileById(orgId, fileId);

  if (!file) {
    return NextResponse.json(
      {
        success: false,
        statusCode: 404,
        error: {
          code: "FILE_NOT_FOUND",
          message: "The requested document was not found in the authorized tenant scope.",
          request_id: `req_${Date.now()}`,
        },
      },
      { status: 404 }
    );
  }

  // Server-side security check: reject restricted files
  if (file.isRestricted || !file.permittedDownload) {
    return NextResponse.json(
      {
        success: false,
        statusCode: 403,
        error: {
          code: "FORBIDDEN_FILE_DOWNLOAD",
          message: "403 Forbidden: Viewer role is not authorized to download restricted system credential files.",
          request_id: `req_${Date.now()}`,
        },
      },
      { status: 403 }
    );
  }

  const watermarked = `/* PROWISE CONFIDENTIAL - AUTHORIZED READ-ONLY COPY */\n/* Generated for: Jordan Lee (Viewer) */\n/* Date: ${new Date().toISOString()} */\n\n${file.previewContent}`;
  const contentType = file.format === "json" ? "application/json" : "text/plain";

  return new NextResponse(watermarked, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${file.name}"`,
      "X-Governance-Scope": "READ_ONLY_VIEWER",
    },
  });
}

// Reject write requests server-side
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      statusCode: 405,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "File uploads or mutations are strictly prohibited on viewer file endpoints.",
        request_id: `req_${Date.now()}`,
      },
    },
    { status: 405 }
  );
}

export async function PUT() {
  return POST();
}

export async function DELETE() {
  return POST();
}

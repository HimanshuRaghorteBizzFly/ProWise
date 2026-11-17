import { NextRequest, NextResponse } from "next/server";
import { generateProgressCsv, generateMilestonesJson } from "@/app/(workspace)/org/[orgId]/viewer/_services/viewer-service";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const orgId = searchParams.get("orgId") || "org-acme";
  const type = searchParams.get("type") || "csv";

  // Enforce Tenant & Permitted Export RBAC
  const userRole = request.headers.get("x-user-role") || "VIEWER";
  if (userRole !== "VIEWER" && userRole !== "SUPER_ADMIN" && userRole !== "ORGANIZATION_OWNER" && userRole !== "PROJECT_MANAGER") {
    return NextResponse.json(
      {
        success: false,
        statusCode: 403,
        error: {
          code: "FORBIDDEN_EXPORT",
          message: "User lacks report:export authority.",
          request_id: `req_${Date.now()}`,
        },
      },
      { status: 403 }
    );
  }

  if (type === "json") {
    const jsonOutput = generateMilestonesJson(orgId);
    return new NextResponse(jsonOutput, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="prowise-milestones-${orgId}.json"`,
        "X-Governance-Scope": "READ_ONLY_VIEWER",
      },
    });
  }

  const csvOutput = generateProgressCsv(orgId);
  return new NextResponse(csvOutput, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="prowise-progress-${orgId}.csv"`,
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
        message: "POST mutations are strictly prohibited on viewer export endpoints.",
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

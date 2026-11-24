import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface SuperAdminUserItem {
  id: string;
  email: string;
  name: string;
  role: string;
  department?: string | null;
  organization_id?: string | null;
  organization_name?: string | null;
  phone?: string | null;
  status: "ACTIVE" | "DISABLED" | "PENDING_ACTIVATION" | string;
  must_change_password: boolean;
  last_login_at?: string | null;
  created_at: string;
  email_delivery_status?: string | null;
  email_delivery_message?: string | null;
}

const GLOBAL_USERS: SuperAdminUserItem[] = [
  {
    id: "usr-alex-rivera",
    name: "Alex Rivera",
    email: "alex.rivera@acmehealth.com",
    role: "DEVELOPER",
    department: "Platform Squad",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+1 (555) 234-5678",
    status: "ACTIVE",
    must_change_password: false,
    last_login_at: "2026-11-23T10:15:00Z",
    created_at: "2026-08-01T09:00:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-priya-raman",
    name: "Priya Raman",
    email: "priya.raman@acme.dev",
    role: "PROJECT_MANAGER",
    department: "Platform Squad",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+44 20 7946 0912",
    status: "ACTIVE",
    must_change_password: false,
    last_login_at: "2026-11-23T09:45:00Z",
    created_at: "2026-08-01T09:00:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-marcus-chen",
    name: "Marcus Chen",
    email: "marcus.chen@acme.dev",
    role: "TEAM_LEAD",
    department: "Platform Squad",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+1 (416) 555-0199",
    status: "ACTIVE",
    must_change_password: false,
    last_login_at: "2026-11-23T08:30:00Z",
    created_at: "2026-08-01T09:00:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-elena-ruiz",
    name: "Elena Ruiz",
    email: "elena.ruiz@acme.dev",
    role: "QA_REVIEWER",
    department: "Platform Squad",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+34 91 123 4567",
    status: "ACTIVE",
    must_change_password: false,
    last_login_at: "2026-11-22T17:20:00Z",
    created_at: "2026-08-05T10:00:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-aisha-bello",
    name: "Aisha Bello",
    email: "aisha.bello@acme.dev",
    role: "DEVELOPER",
    department: "Platform Squad",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+234 1 234 5678",
    status: "ACTIVE",
    must_change_password: false,
    last_login_at: "2026-11-23T11:00:00Z",
    created_at: "2026-08-10T11:00:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-diego-alvarez",
    name: "Diego Alvarez",
    email: "diego.alvarez@acme.dev",
    role: "DEVELOPER",
    department: "Platform Squad",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+52 55 1234 5678",
    status: "ACTIVE",
    must_change_password: false,
    last_login_at: "2026-11-22T15:10:00Z",
    created_at: "2026-08-12T14:30:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-sofia-novak",
    name: "Sofia Novak",
    email: "sofia.novak@acme.dev",
    role: "DEVELOPER",
    department: "Platform Squad",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+420 2 1234 5678",
    status: "ACTIVE",
    must_change_password: false,
    last_login_at: "2026-11-21T14:40:00Z",
    created_at: "2026-08-15T09:20:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-liam-oconnor",
    name: "Liam O'Connor",
    email: "liam.oconnor@acme.dev",
    role: "DEVELOPER",
    department: "Platform Squad",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+353 1 496 0000",
    status: "ACTIVE",
    must_change_password: false,
    last_login_at: "2026-11-23T07:55:00Z",
    created_at: "2026-08-18T16:00:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-yuki-tanaka",
    name: "Yuki Tanaka",
    email: "yuki.tanaka@acme.dev",
    role: "DEVELOPER",
    department: "Platform Squad",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+81 6 1234 5678",
    status: "PENDING_ACTIVATION",
    must_change_password: true,
    last_login_at: null,
    created_at: "2026-11-20T12:00:00Z",
    email_delivery_status: "DELIVERED",
    email_delivery_message: "Setup invitation email sent successfully to yuki.tanaka@acme.dev",
  },
  {
    id: "usr-himanshu-raghorte",
    name: "Himanshu Raghorte",
    email: "himanshuraghorteatwork@gmail.com",
    role: "ORGANIZATION_OWNER",
    department: "Executive Management",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+91 98765 43210",
    status: "ACTIVE",
    must_change_password: false,
    last_login_at: "2026-11-23T11:15:00Z",
    created_at: "2026-07-15T08:00:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-sarah-jenkins",
    name: "Sarah Jenkins",
    email: "sarah.jenkins@globalfreight.com",
    role: "ORGANIZATION_ADMIN",
    department: "Operations",
    organization_id: "org-global-logistics",
    organization_name: "Global Logistics Corp",
    phone: "+1 (312) 555-0144",
    status: "ACTIVE",
    must_change_password: false,
    last_login_at: "2026-11-22T16:05:00Z",
    created_at: "2026-09-01T10:00:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-david-miller",
    name: "David Miller",
    email: "david.miller@novafin.com",
    role: "ORGANIZATION_OWNER",
    department: "Leadership",
    organization_id: "org-nova-fintech",
    organization_name: "Nova FinTech",
    phone: "+1 (212) 555-0177",
    status: "DISABLED",
    must_change_password: false,
    last_login_at: "2026-10-14T09:00:00Z",
    created_at: "2026-08-20T13:00:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-jordan-lee",
    name: "Jordan Lee",
    email: "jordan.lee@acme.dev",
    role: "VIEWER",
    department: "Product & Executive",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+1 (555) 789-0123",
    status: "ACTIVE",
    must_change_password: false,
    last_login_at: "2026-11-20T11:30:00Z",
    created_at: "2026-09-10T14:15:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-hana-kim",
    name: "Hana Kim",
    email: "hana.kim@acme.dev",
    role: "TEAM_LEAD",
    department: "Mobile Crew",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+82 2 1234 5678",
    status: "PENDING_ACTIVATION",
    must_change_password: true,
    last_login_at: null,
    created_at: "2026-11-21T15:30:00Z",
    email_delivery_status: "DELIVERED",
    email_delivery_message: "Setup invitation email sent successfully to hana.kim@acme.dev",
  },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.toLowerCase().trim() || "";
  const role = searchParams.get("role") || "";
  const status = searchParams.get("status") || "";
  const organizationId = searchParams.get("organizationId") || "";
  const page = parseInt(searchParams.get("page") || "0", 10);
  const size = parseInt(searchParams.get("size") || "12", 10);

  let filtered = [...GLOBAL_USERS];

  if (search) {
    filtered = filtered.filter(
      (u) =>
        u.name.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search) ||
        (u.department && u.department.toLowerCase().includes(search))
    );
  }

  if (role && role !== "ALL") {
    filtered = filtered.filter((u) => u.role === role);
  }

  if (status && status !== "ALL") {
    filtered = filtered.filter((u) => u.status === status);
  }

  if (organizationId === "NONE") {
    filtered = filtered.filter((u) => !u.organization_id);
  } else if (organizationId && organizationId !== "ALL") {
    filtered = filtered.filter((u) => u.organization_id === organizationId);
  }

  const totalElements = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / size));
  const start = page * size;
  const content = filtered.slice(start, start + size);

  return NextResponse.json({
    content,
    total_elements: totalElements,
    total_pages: totalPages,
    number: page,
    size,
    first: page === 0,
    last: page >= totalPages - 1,
    empty: content.length === 0,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const newUser: SuperAdminUserItem = {
      id: `usr-${Date.now()}`,
      name: body.name || "New User",
      email: body.email,
      role: body.role || "DEVELOPER",
      department: body.department || null,
      organization_id: body.organization_id || null,
      organization_name: body.organization_id ? "Assigned Workspace" : null,
      phone: body.phone || null,
      status: "PENDING_ACTIVATION",
      must_change_password: true,
      last_login_at: null,
      created_at: new Date().toISOString(),
      email_delivery_status: body.send_email !== false ? "DELIVERED" : "NOT_REQUESTED",
      email_delivery_message:
        body.send_email !== false ? `Setup invitation emailed to ${body.email}` : undefined,
    };

    GLOBAL_USERS.unshift(newUser);

    return NextResponse.json(newUser, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Invalid request payload" }, { status: 400 });
  }
}

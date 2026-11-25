import fs from "fs";
import path from "path";

const usersPagePath = path.resolve("C:/BizzFly_Project/ProWise/frontend/src/app/(platform)/super-admin/users/page.tsx");
let code = fs.readFileSync(usersPagePath, "utf8");

const replacement = `const SEED_USERS: SuperAdminUserItem[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Super Admin",
    email: "superadmin@prowise.com",
    role: "SUPER_ADMIN",
    department: "Platform Engineering",
    organization_id: null,
    organization_name: null,
    phone: null,
    status: "ACTIVE",
    must_change_password: false,
    last_login_at: new Date().toISOString(),
    created_at: "2026-01-01T00:00:00Z",
    email_delivery_status: "DELIVERED",
  },
];

function getLocalUsers(): SuperAdminUserItem[] {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem("prowise_superadmin_users_v2");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // ignore
      }
    }
  }
  return SEED_USERS;
}

function saveLocalUsers(list: SuperAdminUserItem[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem("prowise_superadmin_users_v2", JSON.stringify(list));
  }
}`;

code = code.replace(/const SEED_USERS: SuperAdminUserItem\[\] = \[[\s\S]*?function saveLocalUsers\(list: SuperAdminUserItem\[\]\) \{[\s\S]*?\n\}/, replacement);
fs.writeFileSync(usersPagePath, code, "utf8");
console.log("Updated users/page.tsx without demo personas.");

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const BACKEND_URL = process.env.API_BACKEND_URL || "http://localhost:8081";

function getEnvFilePath(): string {
  const candidates = [
    path.resolve(process.cwd(), "backend/.env"),
    path.resolve(process.cwd(), "../backend/.env"),
    "C:/BizzFly_Project/ProWise/backend/.env",
    path.resolve(process.cwd(), ".env"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.resolve(process.cwd(), "backend/.env");
}

function parseEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return result;
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx > 0) {
        const key = line.slice(0, eqIdx).trim();
        let val = line.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          if (val.length >= 2) val = val.slice(1, -1);
        }
        result[key] = val;
      }
    }
  } catch {}
  return result;
}

const KNOWN_METAS: Record<string, { category: string; purpose: string; secret: boolean; required: boolean }> = {
  JWT_SIGNING_KEY: { category: "Auth & Security", purpose: "Signs JWT access tokens (Base64 random bytes, at least 32 bytes)", secret: true, required: true },
  JWT_ISSUER: { category: "Auth & Security", purpose: "JWT token issuer claim identifier", secret: false, required: false },
  ACCESS_TOKEN_MINUTES: { category: "Auth & Security", purpose: "Lifespan of JWT access tokens in minutes", secret: false, required: false },
  REFRESH_TOKEN_DAYS: { category: "Auth & Security", purpose: "Lifespan of refresh token session cookies in days", secret: false, required: false },
  DB_URL: { category: "Database", purpose: "PostgreSQL JDBC connection URL", secret: false, required: true },
  DB_USERNAME: { category: "Database", purpose: "PostgreSQL database username", secret: false, required: true },
  DB_PASSWORD: { category: "Database", purpose: "PostgreSQL database password", secret: true, required: true },
  SMTP_HOST: { category: "SMTP Email", purpose: "Outgoing mail server hostname", secret: false, required: true },
  SMTP_PORT: { category: "SMTP Email", purpose: "SMTP connection port (typically 587 or 465)", secret: false, required: true },
  SMTP_USERNAME: { category: "SMTP Email", purpose: "SMTP authentication username or email", secret: false, required: true },
  SMTP_PASSWORD: { category: "SMTP Email", purpose: "SMTP or Gmail App Password", secret: true, required: true },
  SMTP_FROM: { category: "SMTP Email", purpose: "Default sender address for transactional emails", secret: false, required: true },
  SMTP_AUTH: { category: "SMTP Email", purpose: "Enable SMTP basic authentication", secret: false, required: false },
  SMTP_STARTTLS: { category: "SMTP Email", purpose: "Enable STARTTLS cryptographic security", secret: false, required: false },
  SMTP_CREDENTIAL_ENCRYPTION_KEY: { category: "SMTP Email", purpose: "AES-256-GCM key used to encrypt SMTP credentials", secret: true, required: false },
  FRONTEND_URL: { category: "Application & Web", purpose: "Public URL of frontend client for emails and links", secret: false, required: true },
  CORS_ALLOWED_ORIGINS: { category: "Application & Web", purpose: "Allowed HTTP Origin headers for browser CORS", secret: false, required: true },
  AUTH_SECURE_COOKIES: { category: "Application & Web", purpose: "Enable HTTPS Secure attribute on session cookies", secret: false, required: false },
  "server.port": { category: "Application & Web", purpose: "HTTP listening port for backend Spring server", secret: false, required: false },
  PROWISE_BOOTSTRAP_SUPER_ADMIN_EMAIL: { category: "Super Admin", purpose: "Bootstrap super admin account email address", secret: false, required: true },
  PROWISE_BOOTSTRAP_SUPER_ADMIN_PASSWORD: { category: "Super Admin", purpose: "Bootstrap super admin password for initial sign-in", secret: true, required: true },
};

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";

    // Forward to backend if available
    try {
      const backendRes = await fetch(`${BACKEND_URL}/v1/admin/platform-keys`, {
        method: "GET",
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

    // Fallback: read directly from backend/.env
    const envPath = getEnvFilePath();
    const envMap = parseEnvFile(envPath);
    const now = new Date().toISOString();

    const keys: Array<{
      key: string;
      value: string;
      category: string;
      purpose: string;
      secret: boolean;
      required: boolean;
      updatedAt: string;
    }> = [];

    // Add known keys
    for (const [k, meta] of Object.entries(KNOWN_METAS)) {
      keys.push({
        key: k,
        value: envMap[k] || "",
        category: meta.category,
        purpose: meta.purpose,
        secret: meta.secret,
        required: meta.required,
        updatedAt: now,
      });
    }

    // Add custom keys
    for (const [k, v] of Object.entries(envMap)) {
      if (!KNOWN_METAS[k]) {
        const isSecret = /KEY|SECRET|PASSWORD|TOKEN/i.test(k);
        keys.push({
          key: k,
          value: v,
          category: "Custom Configuration",
          purpose: "Custom environment configuration variable",
          secret: isSecret,
          required: false,
          updatedAt: now,
        });
      }
    }

    let lastModified = Date.now();
    try {
      if (fs.existsSync(envPath)) {
        lastModified = fs.statSync(envPath).mtimeMs;
      }
    } catch {}

    return NextResponse.json({
      keys,
      envPath,
      lastModified,
    });
  } catch (error) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Failed to read platform keys." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const body = await req.json();
    const updatedMap: Record<string, string> = body.keys || {};

    const envPath = getEnvFilePath();
    const current = parseEnvFile(envPath);
    Object.assign(current, updatedMap);

    // Build env content
    let content = `# ProWise Platform Server Configuration\n# Updated via Super Admin Platform Keys UI on ${new Date().toISOString()}\n\n`;

    const groups: Record<string, string[]> = {
      Database: ["DB_URL", "DB_USERNAME", "DB_PASSWORD"],
      "Super Admin": ["PROWISE_BOOTSTRAP_SUPER_ADMIN_EMAIL", "PROWISE_BOOTSTRAP_SUPER_ADMIN_PASSWORD"],
      "Auth & Security": ["JWT_SIGNING_KEY", "JWT_ISSUER", "ACCESS_TOKEN_MINUTES", "REFRESH_TOKEN_DAYS"],
      "SMTP Email": ["SMTP_HOST", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD", "SMTP_FROM", "SMTP_AUTH", "SMTP_STARTTLS", "SMTP_CREDENTIAL_ENCRYPTION_KEY"],
      "Application & Web": ["FRONTEND_URL", "CORS_ALLOWED_ORIGINS", "AUTH_SECURE_COOKIES", "server.port"],
    };

    const written = new Set<string>();

    for (const [groupName, groupKeys] of Object.entries(groups)) {
      content += `# --- ${groupName} ---\n`;
      for (const k of groupKeys) {
        if (current[k] !== undefined) {
          content += `${k}=${current[k]}\n`;
          written.add(k);
        }
      }
      content += "\n";
    }

    let hasCustom = false;
    for (const [k, v] of Object.entries(current)) {
      if (!written.has(k)) {
        if (!hasCustom) {
          content += "# --- Custom Configuration ---\n";
          hasCustom = true;
        }
        content += `${k}=${v}\n`;
      }
    }

    // Write file
    const dir = path.dirname(envPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(envPath, content, "utf-8");

    // Also mirror to root .env if it exists
    const rootEnv = "C:/BizzFly_Project/ProWise/.env";
    if (fs.existsSync(rootEnv)) {
      try {
        fs.writeFileSync(rootEnv, content, "utf-8");
      } catch {}
    }

    // Forward to backend if available
    try {
      await fetch(`${BACKEND_URL}/v1/admin/platform-keys`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(authHeader ? { authorization: authHeader } : {}),
        },
        body: JSON.stringify({ keys: updatedMap }),
      });
    } catch {}

    return NextResponse.json({
      ok: true,
      message: "Platform keys & secrets saved to server (.env) successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Failed to save platform keys." },
      { status: 500 }
    );
  }
}

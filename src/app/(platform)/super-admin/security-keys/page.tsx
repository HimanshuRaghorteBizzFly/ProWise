"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  KeyRound,
  Lock,
  Mail,
  ServerCog,
  Eye,
  EyeOff,
  Copy,
  Check,
  Plus,
  Save,
  RefreshCw,
  Trash2,
  ShieldCheck,
  Sparkles,
  Database,
  Radio,
  FileCode,
  AlertTriangle,
} from "lucide-react";
import {
  apiClient,
  type PlatformKeyItem,
  type SmtpSettingsResponse,
} from "@/lib/api";
import {
  AdminButton,
  PageHeader,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
} from "../_components/SuperAdminPrimitives";
import { toast } from "sonner";

export default function SuperAdminSecurityKeysPage() {
  const [keys, setKeys] = useState<PlatformKeyItem[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [originalValues, setOriginalValues] = useState<Record<string, string>>({});
  const [envPath, setEnvPath] = useState<string>("backend/.env");
  const [lastModified, setLastModified] = useState<number>(Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);

  // Visibility state for masked secrets
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Filter
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  // Outgoing SMTP state
  const [smtp, setSmtp] = useState<SmtpSettingsResponse | null>(null);
  const [smtpError, setSmtpError] = useState<string | null>(null);

  // Add new secret modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [newKeyCategory, setNewKeyCategory] = useState("Custom Configuration");
  const [newKeyPurpose, setNewKeyPurpose] = useState("");
  const [newKeyIsSecret, setNewKeyIsSecret] = useState(true);

  const fetchKeysAndSmtp = async () => {
    setIsLoading(true);
    try {
      const [keysRes, smtpRes] = await Promise.allSettled([
        apiClient.platformKeys.get(),
        apiClient.smtp.settings(),
      ]);

      if (keysRes.status === "fulfilled" && keysRes.value) {
        const fetchedKeys = keysRes.value.keys || [];
        setKeys(fetchedKeys);
        setEnvPath(keysRes.value.envPath || "backend/.env");
        setLastModified(keysRes.value.lastModified || Date.now());

        const valuesMap: Record<string, string> = {};
        fetchedKeys.forEach((k) => {
          valuesMap[k.key] = k.value || "";
        });
        setFormValues(valuesMap);
        setOriginalValues(valuesMap);
      }

      if (smtpRes.status === "fulfilled" && smtpRes.value) {
        setSmtp(smtpRes.value);
        setSmtpError(null);
      } else if (smtpRes.status === "rejected") {
        setSmtpError(
          smtpRes.reason instanceof Error
            ? smtpRes.reason.message
            : "Could not load SMTP live status."
        );
      }
    } catch (err) {
      toast.error("Failed to load server platform keys.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKeysAndSmtp();
  }, []);

  const hasUnsavedChanges = useMemo(() => {
    return Object.keys(formValues).some(
      (k) => (formValues[k] || "") !== (originalValues[k] || "")
    );
  }, [formValues, originalValues]);

  const toggleVisibility = (key: string) => {
    setVisibleSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopy = async (key: string, val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedKey(key);
      toast.success(`Copied ${key} to clipboard`);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleGenerateJwtKey = async () => {
    try {
      const res = await apiClient.platformKeys.generateJwtKey();
      if (res?.key) {
        setFormValues((prev) => ({ ...prev, JWT_SIGNING_KEY: res.key }));
        setVisibleSecrets((prev) => ({ ...prev, JWT_SIGNING_KEY: true }));
        toast.success("Generated new 64-byte JWT signing key!");
      }
    } catch {
      // Fallback local crypto generation
      const bytes = new Uint8Array(64);
      crypto.getRandomValues(bytes);
      const binary = String.fromCharCode(...bytes);
      const base64 = btoa(binary);
      setFormValues((prev) => ({ ...prev, JWT_SIGNING_KEY: base64 }));
      setVisibleSecrets((prev) => ({ ...prev, JWT_SIGNING_KEY: true }));
      toast.success("Generated new 64-byte JWT signing key locally!");
    }
  };

  const handleGenerateEncryptionKey = async () => {
    try {
      const res = await apiClient.platformKeys.generateEncryptionKey();
      if (res?.key) {
        setFormValues((prev) => ({ ...prev, SMTP_CREDENTIAL_ENCRYPTION_KEY: res.key }));
        setVisibleSecrets((prev) => ({ ...prev, SMTP_CREDENTIAL_ENCRYPTION_KEY: true }));
        toast.success("Generated new AES-256 encryption key!");
      }
    } catch {
      const bytes = new Uint8Array(48);
      crypto.getRandomValues(bytes);
      const binary = String.fromCharCode(...bytes);
      const base64 = btoa(binary);
      setFormValues((prev) => ({ ...prev, SMTP_CREDENTIAL_ENCRYPTION_KEY: base64 }));
      setVisibleSecrets((prev) => ({ ...prev, SMTP_CREDENTIAL_ENCRYPTION_KEY: true }));
      toast.success("Generated new AES-256 encryption key locally!");
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const res = await apiClient.platformKeys.save(formValues);
      if (res?.ok) {
        setOriginalValues({ ...formValues });
        toast.success("All platform keys & secrets saved to server (.env) successfully!");
        setLastModified(Date.now());
      } else {
        toast.error(res?.message || "Failed to save keys.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error saving configuration keys.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestSmtpConnection = async () => {
    setIsTestingSmtp(true);
    try {
      const res = await apiClient.smtp.testConnection();
      if (res.status === "CONNECTED") {
        toast.success(`SMTP connected successfully to ${res.host || "server"}!`);
      } else {
        toast.error(`SMTP Connection status: ${res.status}. ${res.detail || ""}`);
      }
      // Refresh status
      const updated = await apiClient.smtp.settings().catch(() => null);
      if (updated) setSmtp(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to test connection.");
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const handleAddCustomKey = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = newKeyName.trim().toUpperCase().replace(/[^A-Z0-9_.]/g, "_");
    if (!cleanKey) {
      toast.error("Please enter a valid key name.");
      return;
    }
    if (keys.some((k) => k.key === cleanKey)) {
      toast.error(`Key ${cleanKey} already exists.`);
      return;
    }

    const newItem: PlatformKeyItem = {
      key: cleanKey,
      value: newKeyValue,
      category: newKeyCategory || "Custom Configuration",
      purpose: newKeyPurpose.trim() || "Custom environment configuration variable",
      secret: newKeyIsSecret,
      required: false,
      updatedAt: new Date().toISOString(),
    };

    setKeys((prev) => [...prev, newItem]);
    setFormValues((prev) => ({ ...prev, [cleanKey]: newKeyValue }));
    setIsAddModalOpen(false);
    setNewKeyName("");
    setNewKeyValue("");
    setNewKeyPurpose("");
    toast.success(`Added ${cleanKey}. Remember to save changes to server.`);
  };

  const handleDeleteCustomKey = (keyToDelete: string) => {
    if (!confirm(`Are you sure you want to delete ${keyToDelete}?`)) return;
    setKeys((prev) => prev.filter((k) => k.key !== keyToDelete));
    setFormValues((prev) => {
      const next = { ...prev };
      delete next[keyToDelete];
      return next;
    });
    toast.info(`Removed ${keyToDelete}. Click 'Save to Server' to commit.`);
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    keys.forEach((k) => set.add(k.category || "General"));
    return ["ALL", ...Array.from(set)];
  }, [keys]);

  const filteredKeys = useMemo(() => {
    if (selectedCategory === "ALL") return keys;
    return keys.filter((k) => k.category === selectedCategory);
  }, [keys, selectedCategory]);

  const groupedKeys = useMemo(() => {
    const map = new Map<string, PlatformKeyItem[]>();
    filteredKeys.forEach((k) => {
      const cat = k.category || "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(k);
    });
    return map;
  }, [filteredKeys]);

  return (
    <div className="space-y-5 pb-16">
      <PageHeader
        title="Platform Keys & Secrets"
        description="View, edit, add and persist server-side signing keys, database credentials, and SMTP secrets directly into server configuration."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <AdminButton
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Key / Secret
            </AdminButton>

            <AdminButton
              variant="outline"
              size="sm"
              onClick={fetchKeysAndSmtp}
              disabled={isLoading}
              className="gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Reload
            </AdminButton>

            <AdminButton
              variant="primary"
              size="sm"
              onClick={handleSaveAll}
              disabled={isSaving || !hasUnsavedChanges}
              className="gap-1.5 shadow-sm"
            >
              <Save className={`w-3.5 h-3.5 ${isSaving ? "animate-spin" : ""}`} />
              {isSaving ? "Saving..." : "Save to Server (.env)"}
            </AdminButton>
          </div>
        }
      />

      {hasUnsavedChanges && (
        <div className="flex items-center justify-between p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              You have unsaved changes in your platform secrets. Click <strong>Save to Server (.env)</strong> to write them to the server configuration.
            </span>
          </div>
          <AdminButton
            size="sm"
            variant="primary"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="shrink-0 text-xs py-1 px-3"
          >
            {isSaving ? "Saving..." : "Save Now"}
          </AdminButton>
        </div>
      )}

      {/* Categories Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
              selectedCategory === cat
                ? "bg-blue-600 text-white"
                : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)]"
            }`}
          >
            {cat} {cat === "ALL" ? `(${keys.length})` : `(${keys.filter((k) => k.category === cat).length})`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Main Editable Keys Section */}
        <div className="xl:col-span-8 space-y-5">
          {isLoading ? (
            <SurfaceCard className="p-8 text-center text-sm text-[var(--color-text-muted)] space-y-2">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-500" />
              <p>Loading platform configuration from server...</p>
            </SurfaceCard>
          ) : (
            Array.from(groupedKeys.entries()).map(([category, catKeys]) => (
              <SurfaceCard key={category} className="p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                  <div className="flex items-center gap-2">
                    {category === "Database" && <Database className="w-4 h-4 text-emerald-500" />}
                    {category === "SMTP Email" && <Mail className="w-4 h-4 text-sky-500" />}
                    {category === "Auth & Security" && <KeyRound className="w-4 h-4 text-indigo-500" />}
                    {category === "Super Admin" && <ShieldCheck className="w-4 h-4 text-purple-500" />}
                    {category === "Application & Web" && <Radio className="w-4 h-4 text-amber-500" />}
                    {category === "Custom Configuration" && <FileCode className="w-4 h-4 text-slate-500" />}
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{category}</h3>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {catKeys.length} configured parameter{catKeys.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  {category === "Auth & Security" && (
                    <AdminButton
                      size="sm"
                      variant="outline"
                      onClick={handleGenerateJwtKey}
                      className="text-xs gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" /> Generate JWT Key
                    </AdminButton>
                  )}
                  {category === "SMTP Email" && (
                    <AdminButton
                      size="sm"
                      variant="outline"
                      onClick={handleGenerateEncryptionKey}
                      className="text-xs gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-sky-500" /> Generate AES Key
                    </AdminButton>
                  )}
                </div>

                <div className="space-y-4 divide-y divide-[var(--color-border)]/60">
                  {catKeys.map((item) => {
                    const isVisible = visibleSecrets[item.key] || false;
                    const currentValue = formValues[item.key] ?? item.value ?? "";
                    const isModified = currentValue !== (originalValues[item.key] ?? "");
                    const isCustom = item.category === "Custom Configuration";

                    return (
                      <div key={item.key} className="pt-3.5 first:pt-0 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-[var(--color-text-primary)]">
                              {item.key}
                            </span>
                            {item.required && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                Required
                              </span>
                            )}
                            {item.secret && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                Secret
                              </span>
                            )}
                            {isModified && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                Modified
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {item.key === "JWT_SIGNING_KEY" && (
                              <button
                                type="button"
                                onClick={handleGenerateJwtKey}
                                className="text-[11px] text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1 px-2 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                              >
                                <Sparkles className="w-3 h-3" /> Generate New
                              </button>
                            )}
                            {item.key === "SMTP_CREDENTIAL_ENCRYPTION_KEY" && (
                              <button
                                type="button"
                                onClick={handleGenerateEncryptionKey}
                                className="text-[11px] text-sky-600 hover:text-sky-700 dark:text-sky-400 font-medium flex items-center gap-1 px-2 py-0.5 rounded hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
                              >
                                <Sparkles className="w-3 h-3" /> Generate AES Key
                              </button>
                            )}
                            {isCustom && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomKey(item.key)}
                                className="text-[11px] text-rose-600 hover:text-rose-700 dark:text-rose-400 font-medium flex items-center gap-1 px-2 py-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="text-[11px] text-[var(--color-text-secondary)]">{item.purpose}</p>

                        <div className="relative flex items-center gap-1.5">
                          <div className="relative flex-1">
                            <input
                              type={item.secret && !isVisible ? "password" : "text"}
                              value={currentValue}
                              onChange={(e) =>
                                setFormValues((prev) => ({ ...prev, [item.key]: e.target.value }))
                              }
                              placeholder={`Enter ${item.key}...`}
                              className={`w-full font-mono text-xs px-3 py-2 rounded-md border transition-colors bg-[var(--color-bg)] ${
                                isModified
                                  ? "border-blue-500 ring-1 ring-blue-500/30"
                                  : "border-[var(--color-border)] focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                              } pr-20`}
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                              {item.secret && (
                                <button
                                  type="button"
                                  onClick={() => toggleVisibility(item.key)}
                                  className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
                                  title={isVisible ? "Hide secret" : "Show secret"}
                                >
                                  {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleCopy(item.key, currentValue)}
                                className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
                                title="Copy value"
                              >
                                {copiedKey === item.key ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SurfaceCard>
            ))
          )}
        </div>

        {/* Right Side Cards */}
        <div className="xl:col-span-4 space-y-4">
          {/* Outgoing Email (Live) */}
          <SurfaceCard className="p-4 sm:p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
                <Mail className="w-4 h-4 text-blue-500" /> Outgoing email (live)
              </div>
              <AdminButton
                size="sm"
                variant="outline"
                onClick={handleTestSmtpConnection}
                disabled={isTestingSmtp}
                className="text-[11px] py-0.5 px-2"
              >
                {isTestingSmtp ? "Testing..." : "Test Connection"}
              </AdminButton>
            </div>

            {smtpError && <p className="text-rose-600 dark:text-rose-400">{smtpError}</p>}
            {!smtp && !smtpError && <p className="text-[var(--color-text-muted)]">Loading…</p>}

            {smtp && (
              <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-2 pt-1 border-t border-[var(--color-border)]">
                <dt className="text-[var(--color-text-muted)] font-medium">Status</dt>
                <dd>
                  <StatusBadge
                    label={smtp.connection_status.replace(/_/g, " ")}
                    tone={getStatusTone(smtp.connection_status)}
                    dot
                  />
                </dd>
                <dt className="text-[var(--color-text-muted)] font-medium">Server Host</dt>
                <dd className="break-all font-mono text-[11px]">
                  {smtp.host || "smtp.gmail.com"}:{smtp.port} ({smtp.encryption})
                </dd>
                <dt className="text-[var(--color-text-muted)] font-medium">Credentials</dt>
                <dd>
                  {smtp.credentials_configured
                    ? `Configured (${smtp.password_source.toLowerCase()})`
                    : "Not configured"}
                </dd>
                <dt className="text-[var(--color-text-muted)] font-medium">Encryption Key</dt>
                <dd>
                  {smtp.encryption_key_configured
                    ? "Configured (AES-256)"
                    : "Missing (SMTP_CREDENTIAL_ENCRYPTION_KEY)"}
                </dd>
                <dt className="text-[var(--color-text-muted)] font-medium">Sender Email</dt>
                <dd className="font-mono text-[11px] break-all">{smtp.from_email || smtp.username}</dd>
              </dl>
            )}

            <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between">
              <span className="text-[11px] text-[var(--color-text-muted)]">Detailed SMTP management</span>
              <Link href="/super-admin/email-settings">
                <AdminButton variant="outline" size="sm" className="text-xs py-1">
                  Configure SMTP
                </AdminButton>
              </Link>
            </div>
          </SurfaceCard>

          {/* Server Storage & Sync Info */}
          <SurfaceCard className="p-4 sm:p-5 space-y-3 text-xs text-[var(--color-text-secondary)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
              <ServerCog className="w-4 h-4 text-emerald-500" /> Server Configuration File
            </div>
            <p>
              Platform keys, passwords and signing secrets are written directly to the host environment file:
            </p>
            <div className="p-2.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] font-mono text-[11px] text-[var(--color-text-primary)] break-all">
              {envPath}
            </div>
            <div className="text-[11px] space-y-1 text-[var(--color-text-muted)]">
              <p>• Changes saved here are persisted securely to the host file system.</p>
              <p>• The Spring Boot backend reloads environment variables automatically.</p>
              <p>• Never commit production secrets to Git version control.</p>
            </div>
          </SurfaceCard>
        </div>
      </div>

      {/* Add Custom Key Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Add Platform Secret / Key
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCustomKey} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">
                  Key Name (e.g. STRIPE_API_KEY, OPENAI_API_KEY)
                </label>
                <input
                  type="text"
                  required
                  placeholder="MY_NEW_SECRET_KEY"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value.toUpperCase().replace(/\s+/g, "_"))}
                  className="w-full font-mono text-xs px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">
                  Category
                </label>
                <select
                  value={newKeyCategory}
                  onChange={(e) => setNewKeyCategory(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]"
                >
                  <option value="Custom Configuration">Custom Configuration</option>
                  <option value="Auth & Security">Auth & Security</option>
                  <option value="Database">Database</option>
                  <option value="SMTP Email">SMTP Email</option>
                  <option value="Application & Web">Application & Web</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">
                  Purpose / Description
                </label>
                <input
                  type="text"
                  placeholder="Purpose of this configuration key..."
                  value={newKeyPurpose}
                  onChange={(e) => setNewKeyPurpose(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">
                  Value
                </label>
                <input
                  type={newKeyIsSecret ? "password" : "text"}
                  required
                  placeholder="Enter secret value..."
                  value={newKeyValue}
                  onChange={(e) => setNewKeyValue(e.target.value)}
                  className="w-full font-mono text-xs px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isSecretCheck"
                  checked={newKeyIsSecret}
                  onChange={(e) => setNewKeyIsSecret(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isSecretCheck" className="text-xs text-[var(--color-text-secondary)]">
                  Mask as secret (hide characters in UI by default)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
                <AdminButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </AdminButton>
                <AdminButton type="submit" variant="primary" size="sm">
                  Add Key
                </AdminButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

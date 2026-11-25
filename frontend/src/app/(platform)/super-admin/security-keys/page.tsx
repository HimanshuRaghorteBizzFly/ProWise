"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { PlatformKeysView } from "@/components/super-admin/PlatformKeysView";
import { useAdminResource } from "@/components/super-admin/admin-resource";

/** Earlier versions of this page kept secrets in browser storage; any copies left behind are removed on load. */
const LEGACY_BROWSER_KEYS = ["prowise_platform_secrets", "prowise_smtp_password"];

export default function SuperAdminSecurityKeysPage() {
  const keys = useAdminResource(() => apiClient.platformKeys.get(), "platform-keys");
  const smtp = useAdminResource(() => apiClient.smtp.settings(), "smtp-settings");
  const [removedLegacy, setRemovedLegacy] = useState(false);

  useEffect(() => {
    try {
      let removed = false;
      for (const key of LEGACY_BROWSER_KEYS) {
        if (localStorage.getItem(key) !== null) {
          localStorage.removeItem(key);
          removed = true;
        }
      }
      setRemovedLegacy(removed);
    } catch {
      // storage unavailable: nothing to clean
    }
  }, []);

  return (
    <PlatformKeysView
      keys={keys.state}
      smtp={smtp.state}
      removedLegacy={removedLegacy}
      onRetryKeys={() => void keys.reload()}
      onRetrySmtp={() => void smtp.reload()}
    />
  );
}

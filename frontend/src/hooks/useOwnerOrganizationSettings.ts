import { useCallback, useEffect, useState } from "react";

import type { Organization } from "@/types";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";

export type OwnerOrganizationSettingsState =
  | { status: "loading"; orgId: string }
  | { status: "ready"; orgId: string; organization: Organization }
  | { status: "error"; orgId: string; message: string }
  | { status: "access-lost"; orgId: string };

export type OwnerOrganizationSettingsUpdate = Pick<
  Organization,
  "name" | "timezone" | "workCalendar"
>;

export function getOwnerOrganizationSettingsStateForOrg(
  state: OwnerOrganizationSettingsState,
  orgId: string,
  activeOrgId: string,
  workspaceOrgId: string,
): OwnerOrganizationSettingsState {
  if (state.orgId !== orgId) return { status: "loading", orgId };
  if (!orgId || activeOrgId !== orgId || workspaceOrgId !== orgId) {
    return { status: "access-lost", orgId };
  }
  return state;
}

export function useOwnerOrganizationSettings(orgId: string) {
  const organization = useAuthStore((state) => state.currentOrg);
  const workspaceOrganization = useWorkspaceStore((state) => state.currentOrg);
  const updateWorkspaceOrganization = useWorkspaceStore((state) => state.updateOrganization);
  const setActiveOrganization = useAuthStore((state) => state.setCurrentOrg);
  const [state, setState] = useState<OwnerOrganizationSettingsState>({
    status: "loading",
    orgId,
  });

  useEffect(() => {
    if (
      !orgId ||
      organization.id !== orgId ||
      workspaceOrganization.id !== orgId
    ) {
      setState({ status: "access-lost", orgId });
      return;
    }
    if (
      !Array.isArray(organization.workCalendar?.workDays) ||
      !Array.isArray(organization.workCalendar?.holidays)
    ) {
      setState({
        status: "error",
        orgId,
        message: "Organization calendar settings could not be loaded. Reload and try again.",
      });
      return;
    }

    setState({ status: "ready", orgId, organization });
  }, [orgId, organization, workspaceOrganization]);

  const save = useCallback(
    (updates: OwnerOrganizationSettingsUpdate) => {
      if (organization.id !== orgId || workspaceOrganization.id !== orgId) {
        setState({ status: "access-lost", orgId });
        return false;
      }

      const updatedOrganization: Organization = {
        ...organization,
        ...updates,
        workCalendar: { ...updates.workCalendar },
      };
      updateWorkspaceOrganization(orgId, updates);
      setActiveOrganization(updatedOrganization);
      setState({ status: "ready", orgId, organization: updatedOrganization });
      return true;
    },
    [
      orgId,
      organization,
      setActiveOrganization,
      updateWorkspaceOrganization,
      workspaceOrganization.id,
    ],
  );

  return {
    state: getOwnerOrganizationSettingsStateForOrg(
      state,
      orgId,
      organization.id,
      workspaceOrganization.id,
    ),
    save,
  };
}

export interface OrganizationSettingsDraft {
  name: string;
  timezone: string;
  workDays: number[];
  dailyHours: number;
  holidays: string[];
}

export interface OrganizationSettingsErrors {
  name?: string;
  timezone?: string;
  workDays?: string;
  dailyHours?: string;
  holidays?: string;
}

export function validateOrganizationSettings(
  draft: OrganizationSettingsDraft,
): OrganizationSettingsErrors {
  const errors: OrganizationSettingsErrors = {
    name: undefined,
    timezone: undefined,
    workDays: undefined,
    dailyHours: undefined,
    holidays: undefined,
  };

  if (!draft.name.trim()) {
    errors.name = "Enter an organization name.";
  }

  if (!isValidIanaTimezone(draft.timezone.trim())) {
    errors.timezone = "Enter a valid IANA timezone.";
  }

  if (!Number.isFinite(draft.dailyHours) || draft.dailyHours <= 0 || draft.dailyHours > 24) {
    errors.dailyHours = "Daily hours must be greater than 0 and no more than 24.";
  }

  if (
    draft.workDays.length === 0 ||
    draft.workDays.some((day) => !Number.isInteger(day) || day < 1 || day > 7) ||
    new Set(draft.workDays).size !== draft.workDays.length
  ) {
    errors.workDays = "Select at least one working day.";
  }

  if (
    new Set(draft.holidays).size !== draft.holidays.length ||
    draft.holidays.some((holiday) => !isIsoDate(holiday))
  ) {
    errors.holidays = "Use unique valid dates in YYYY-MM-DD format.";
  }

  return errors;
}

function isValidIanaTimezone(timezone: string): boolean {
  if (!timezone) return false;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

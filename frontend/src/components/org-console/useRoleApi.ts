"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import { FIXTURE_GRANTS } from "@/lib/fixtures/permissions";
import { classifyFailure, readPermissionEnv } from "@/lib/permissions";
import { API_CUSTOM_ROLE_FIXTURES, API_GRANT_FIXTURES, API_MEMBER_FIXTURES, ROLE_TEMPLATE_IDS } from "@/mocks/org-console";
import type { GrantDto, GrantRequestDto, MemberDto, RoleDto, RoleHolderDto, RoleRequestDto } from "@/types/api";

/**
 * Roles & Permissions data (task 1.3). Everything comes from the real API; the dev fixture is used only
 * when mocks are allowed and the API is unreachable, and then the screens are read-only ("Sample data").
 */

export type LoadState<T> =
  | { kind: "loading" }
  | { kind: "ready"; data: T; sample: boolean }
  | { kind: "forbidden" }
  | { kind: "access-lost" }
  | { kind: "unauthenticated" }
  | { kind: "error"; retry: () => void };

class SampleData<T> {
  constructor(readonly data: T) {}
}

export function useOrgId(): string {
  const params = useParams();
  return (params?.orgId as string) || "";
}

function fixtureRoles(): RoleDto[] {
  const templates = (Object.keys(ROLE_TEMPLATE_IDS) as (keyof typeof ROLE_TEMPLATE_IDS)[]).map((name) => ({
    id: ROLE_TEMPLATE_IDS[name],
    name,
    template: true,
    owner_only: name === "ORGANIZATION_OWNER",
    version: 0,
    grant_count: API_GRANT_FIXTURES.filter((grant) => grant.template_role_id === ROLE_TEMPLATE_IDS[name]).length,
    permission_keys: (FIXTURE_GRANTS[name] ?? []).map((grant) => grant.key).sort(),
  }));
  return [...templates, ...API_CUSTOM_ROLE_FIXTURES];
}

async function withFixture<T>(call: () => Promise<T>, fixture: () => T): Promise<T | SampleData<T>> {
  try {
    return await call();
  } catch (error) {
    if (classifyFailure(error, readPermissionEnv()) === "fixture") return new SampleData(fixture());
    throw error;
  }
}

export function toState<T>(query: {
  isPending: boolean;
  error: unknown;
  data: T | SampleData<T> | undefined;
  refetch: () => unknown;
}): LoadState<T> {
  if (query.isPending) return { kind: "loading" };
  if (query.error) {
    const kind = classifyFailure(query.error, readPermissionEnv());
    if (kind === "forbidden") return { kind: "forbidden" };
    if (kind === "not-found") return { kind: "access-lost" };
    if (kind === "unauthenticated") return { kind: "unauthenticated" };
    return { kind: "error", retry: () => void query.refetch() };
  }
  const value = query.data as T | SampleData<T>;
  return value instanceof SampleData ? { kind: "ready", data: value.data, sample: true } : { kind: "ready", data: value, sample: false };
}

const QUERY = { retry: false } as const;

export function useRoles(orgId: string): LoadState<RoleDto[]> {
  return toState(useQuery({ queryKey: ["roles", orgId], queryFn: () => withFixture(() => apiClient.roles(orgId), fixtureRoles), ...QUERY }));
}

export function useRole(orgId: string, roleId: string): LoadState<RoleDto> {
  return toState(
    useQuery({
      queryKey: ["role", orgId, roleId],
      queryFn: () =>
        withFixture(
          () => apiClient.role(orgId, roleId),
          () => {
            const role = fixtureRoles().find((candidate) => candidate.id === roleId);
            if (!role) throw Object.assign(new Error("not found"), { status: 404 });
            return role;
          },
        ),
      ...QUERY,
    }),
  );
}

export function useRoleHolders(orgId: string, roleId: string): LoadState<RoleHolderDto[]> {
  return toState(
    useQuery({
      queryKey: ["role-holders", orgId, roleId],
      queryFn: () =>
        withFixture(
          () => apiClient.roleHolders(orgId, roleId),
          () =>
            API_GRANT_FIXTURES.filter((grant) => (grant.template_role_id ?? grant.org_role_id) === roleId).map((grant) => {
              const member = API_MEMBER_FIXTURES.find((candidate) => candidate.id === grant.membership_id);
              return {
                grant_id: grant.id,
                membership_id: grant.membership_id,
                email: member?.email ?? "",
                status: member?.status ?? "ACTIVE",
                scope: grant.scope,
                scope_id: grant.scope_id,
                expires_at: grant.expires_at,
                version: grant.version,
              };
            }),
        ),
      ...QUERY,
    }),
  );
}

export function useMembers(orgId: string): LoadState<MemberDto[]> {
  return toState(
    useQuery({ queryKey: ["members", orgId], queryFn: () => withFixture(() => apiClient.members(orgId), () => API_MEMBER_FIXTURES), ...QUERY }),
  );
}

export function useMemberGrants(orgId: string, membershipId: string): LoadState<GrantDto[]> {
  return toState(
    useQuery({
      queryKey: ["member-grants", orgId, membershipId],
      enabled: Boolean(membershipId),
      queryFn: () =>
        withFixture(
          () => apiClient.memberGrants(orgId, membershipId),
          () => API_GRANT_FIXTURES.filter((grant) => grant.membership_id === membershipId),
        ),
      ...QUERY,
    }),
  );
}

/** Mutations invalidate every role, member and permission query of the organization. */
export function useRoleMutations(orgId: string) {
  const invalidate = useReloadRoleData(orgId);
  return {
    createRole: useMutation({ mutationFn: (body: RoleRequestDto) => apiClient.createRole(orgId, body), onSuccess: invalidate }),
    updateRole: useMutation({
      mutationFn: (input: { roleId: string; body: RoleRequestDto }) => apiClient.updateRole(orgId, input.roleId, input.body),
      onSuccess: invalidate,
    }),
    deleteRole: useMutation({
      mutationFn: (input: { roleId: string; version: number }) => apiClient.deleteRole(orgId, input.roleId, input.version),
      onSuccess: invalidate,
    }),
    grantRole: useMutation({ mutationFn: (body: GrantRequestDto) => apiClient.grantRole(orgId, body), onSuccess: invalidate }),
    revokeGrant: useMutation({
      mutationFn: (input: { grantId: string; version: number }) => apiClient.revokeGrant(orgId, input.grantId, input.version),
      onSuccess: invalidate,
    }),
  };
}

/** Error code and message from an API error ({ code, message, request_id, field_errors }). */
export function apiErrorMessage(error: unknown): string {
  const message = baseErrorMessage(error);
  const requestId =
    typeof error === "object" && error && "requestId" in error ? String((error as { requestId: unknown }).requestId ?? "") : "";
  return requestId ? `${message} (Reference: ${requestId})` : message;
}

/** Reloads every role, member and grant query of the organization (used after a STALE_VERSION conflict). */
export function useReloadRoleData(orgId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ["roles", "role", "role-holders", "members", "member-grants"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key, orgId] }),
      ),
    );
}

function baseErrorMessage(error: unknown): string {
  if (typeof error === "object" && error && "code" in error) {
    const code = String((error as { code: string }).code);
    if (code === "SELF_ELEVATION_DENIED") return "You can't give yourself permissions you don't hold.";
    if (code === "OWNER_TRANSFER_REQUIRED") return "The owner role only changes through ownership transfer.";
    if (code === "STALE_VERSION") return "Someone else changed this. Reload and try again.";
    if (code === "DUPLICATE_ROLE") return "A role with this name already exists.";
    if (code === "ROLE_IN_USE") return "Revoke this role from every member before deleting it.";
    if (code === "MEMBER_INACTIVE") return "Only active members can receive a role.";
    if (code === "FORBIDDEN") return "You don't have permission to do this.";
    if (code === "NOT_FOUND") return "That item doesn't exist or isn't in this workspace.";
    // Validation: show what is wrong with the first field in plain words, not the generic summary.
    const fieldErrors = (error as { fieldErrors?: { field: string; message: string }[] }).fieldErrors;
    if (code === "VALIDATION_FAILED" && fieldErrors && fieldErrors.length > 0) {
      const first = fieldErrors[0];
      const label = first.field.replace(/_/g, " ").replace(/\./g, " ").replace(/^\w/, (c) => c.toUpperCase());
      return /^[A-Z]/.test(first.message) ? first.message : `${label} ${first.message}.`;
    }
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

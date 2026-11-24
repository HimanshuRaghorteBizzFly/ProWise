"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import type {
  CreateInvitationDto,
  HandoverItemDto,
  InvitationDto,
  MemberDto,
  MemberOwnershipDto,
  MemberStatusRequestDto,
  OwnershipDto,
  RoleDto,
  TeamDto,
  TransferOwnershipDto,
} from "@/types/api";
import { toState, type LoadState } from "./useRoleApi";

/**
 * People data for task 1.2 (invitations, teams, member changes, handover, ownership). Real API only:
 * these screens write, so there is no sample fallback.
 */

const QUERY = { retry: false } as const;
const PEOPLE_KEYS = ["invitations", "invitation", "teams", "team", "members", "member-ownership", "handover-items", "ownership",
  "member-grants", "roles", "role-holders"] as const;

export function useInvitations(orgId: string): LoadState<InvitationDto[]> {
  return toState(useQuery({ queryKey: ["invitations", orgId], queryFn: () => apiClient.invitations(orgId), ...QUERY }));
}

export function useInvitation(orgId: string, invitationId: string): LoadState<InvitationDto> {
  return toState(useQuery({
    queryKey: ["invitation", orgId, invitationId],
    queryFn: () => apiClient.invitation(orgId, invitationId),
    enabled: Boolean(invitationId),
    ...QUERY,
  }));
}

export function useTeams(orgId: string): LoadState<TeamDto[]> {
  return toState(useQuery({ queryKey: ["teams", orgId], queryFn: () => apiClient.teams(orgId), ...QUERY }));
}

export function useTeam(orgId: string, teamId: string): LoadState<TeamDto> {
  return toState(useQuery({ queryKey: ["team", orgId, teamId], queryFn: () => apiClient.team(orgId, teamId), ...QUERY }));
}

export function usePeopleMembers(orgId: string): LoadState<MemberDto[]> {
  return toState(useQuery({ queryKey: ["members", orgId], queryFn: () => apiClient.members(orgId), ...QUERY }));
}

export function useTemplateRoles(orgId: string): LoadState<RoleDto[]> {
  return toState(useQuery({ queryKey: ["roles", orgId], queryFn: () => apiClient.roles(orgId), ...QUERY }));
}

export function useMemberOwnership(orgId: string, membershipId: string): LoadState<MemberOwnershipDto> {
  return toState(useQuery({
    queryKey: ["member-ownership", orgId, membershipId],
    queryFn: () => apiClient.memberOwnership(orgId, membershipId),
    ...QUERY,
  }));
}

export function useHandoverItems(orgId: string, enabled = true): LoadState<HandoverItemDto[]> {
  return toState(useQuery({
    queryKey: ["handover-items", orgId],
    queryFn: () => apiClient.handoverItems(orgId),
    enabled,
    ...QUERY,
  }));
}

export function useOwnership(orgId: string): LoadState<OwnershipDto> {
  return toState(useQuery({ queryKey: ["ownership", orgId], queryFn: () => apiClient.ownership(orgId), ...QUERY }));
}

/** Reload every people query of the organization (after a change, or after a STALE_VERSION conflict). */
export function useReloadPeople(orgId: string) {
  const queryClient = useQueryClient();
  return () => Promise.all(PEOPLE_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key, orgId] })));
}

export function usePeopleMutations(orgId: string) {
  const onSuccess = useReloadPeople(orgId);
  return {
    createInvitation: useMutation({ mutationFn: (body: CreateInvitationDto) => apiClient.createInvitation(orgId, body), onSuccess }),
    resendInvitation: useMutation({
      mutationFn: (input: { id: string; version: number }) => apiClient.resendInvitation(orgId, input.id, input.version),
      onSuccess,
    }),
    revokeInvitation: useMutation({
      mutationFn: (input: { id: string; version: number }) => apiClient.revokeInvitation(orgId, input.id, input.version),
      onSuccess,
    }),
    createTeam: useMutation({
      mutationFn: (body: { name: string; description?: string | null; lead_membership_id?: string | null }) =>
        apiClient.createTeam(orgId, body),
      onSuccess,
    }),
    updateTeam: useMutation({
      mutationFn: (input: { id: string; name: string; description: string | null; version: number }) =>
        apiClient.updateTeam(orgId, input.id, { name: input.name, description: input.description, expected_version: input.version }),
      onSuccess,
    }),
    archiveTeam: useMutation({
      mutationFn: (input: { id: string; version: number }) => apiClient.archiveTeam(orgId, input.id, input.version),
      onSuccess,
    }),
    addTeamMember: useMutation({
      mutationFn: (input: { id: string; membershipId: string; version: number }) =>
        apiClient.addTeamMember(orgId, input.id, input.membershipId, input.version),
      onSuccess,
    }),
    removeTeamMember: useMutation({
      mutationFn: (input: { id: string; membershipId: string; version: number }) =>
        apiClient.removeTeamMember(orgId, input.id, input.membershipId, input.version),
      onSuccess,
    }),
    changeTeamLead: useMutation({
      mutationFn: (input: { id: string; membershipId: string | null; version: number }) =>
        apiClient.changeTeamLead(orgId, input.id, input.membershipId, input.version),
      onSuccess,
    }),
    changeMemberRole: useMutation({
      mutationFn: (input: { membershipId: string; templateRoleId: string; version: number }) =>
        apiClient.changeMemberRole(orgId, input.membershipId, input.templateRoleId, input.version),
      onSuccess,
    }),
    changeMemberStatus: useMutation({
      mutationFn: (input: { membershipId: string; body: MemberStatusRequestDto }) =>
        apiClient.changeMemberStatus(orgId, input.membershipId, input.body),
      onSuccess,
    }),
    resolveHandover: useMutation({
      mutationFn: (input: { id: string; replacementId: string; version: number }) =>
        apiClient.resolveHandover(orgId, input.id, input.replacementId, input.version),
      onSuccess,
    }),
    transferOwnership: useMutation({
      mutationFn: (body: TransferOwnershipDto) => apiClient.transferOwnership(orgId, body),
      onSuccess,
    }),
  };
}

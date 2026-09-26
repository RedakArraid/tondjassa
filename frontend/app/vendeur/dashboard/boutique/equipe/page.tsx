'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { SellerService } from '../../../../config/api';
import { Spinner } from '../../_components/sections';
import { SellerPageHeader, SellerActionButton, SellerCard, SellerEmptyState } from '../../_components/ui';
import { useSellerAccess } from '../../_components/access';

type InviteRole = 'manager' | 'catalog' | 'orders' | 'finance';

interface TeamMember {
  id: string;
  name?: string | null;
  email: string;
  role: string;
  status?: string;
  permissions: string[];
  joinedAt?: string;
}

interface TeamInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt?: string;
}

const ROLES: { value: InviteRole; label: string }[] = [
  { value: 'manager', label: 'Manager' },
  { value: 'catalog', label: 'Catalogue' },
  { value: 'orders', label: 'Commandes' },
  { value: 'finance', label: 'Finance' },
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function parseMember(value: unknown): TeamMember | null {
  const member = asRecord(value);
  if (!member || (typeof member.id !== 'string' && typeof member.id !== 'number') || typeof member.email !== 'string' || typeof member.role !== 'string') return null;
  return {
    id: String(member.id),
    name: typeof member.name === 'string' ? member.name : null,
    email: member.email,
    role: member.role,
    status: typeof member.status === 'string' ? member.status : undefined,
    permissions: Array.isArray(member.permissions) ? member.permissions.filter((permission): permission is string => typeof permission === 'string') : [],
    joinedAt: typeof member.joinedAt === 'string' ? member.joinedAt : undefined,
  };
}

function parseInvitation(value: unknown): TeamInvitation | null {
  const invitation = asRecord(value);
  if (!invitation || (typeof invitation.id !== 'string' && typeof invitation.id !== 'number') || typeof invitation.email !== 'string' || typeof invitation.role !== 'string') return null;
  return {
    id: String(invitation.id),
    email: invitation.email,
    role: invitation.role,
    status: typeof invitation.status === 'string' ? invitation.status : 'pending',
    createdAt: typeof invitation.createdAt === 'string' ? invitation.createdAt : undefined,
  };
}

function parseTeam(payload: unknown): { members: TeamMember[]; invitations: TeamInvitation[] } {
  const record = asRecord(payload);
  const rawMembers = Array.isArray(payload) ? payload : record?.members;
  const rawInvitations = Array.isArray(record?.invitations) ? record.invitations : [];
  if (!Array.isArray(rawMembers)) throw new Error('Réponse d’équipe invalide.');
  return {
    members: rawMembers.map(parseMember).filter((member): member is TeamMember => member !== null),
    invitations: rawInvitations.map(parseInvitation).filter((invitation): invitation is TeamInvitation => invitation !== null),
  };
}

export default function EquipePage() {
  const { can } = useSellerAccess();
  const canManageTeam = can('team.manage');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('catalog');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = parseTeam(await SellerService.getMyTeam());
      setMembers(data.members);
      setInvitations(data.invitations);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Impossible de charger les membres.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    SellerService.getMyTeam()
      .then(data => {
        if (!active) return;
        const parsed = parseTeam(data);
        setMembers(parsed.members);
        setInvitations(parsed.invitations);
      })
      .catch(error => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Impossible de charger les membres.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      const response = await SellerService.inviteTeamMember(normalizedEmail, role);
      const responseRecord = asRecord(response);
      const invitation = parseInvitation(responseRecord?.invitation);
      if (!invitation) throw new Error('Invitation créée, mais réponse serveur invalide. Rechargez la page pour vérifier son statut.');
      setInvitations(current => [invitation, ...current.filter(item => item.id !== invitation.id)]);
      setEmail('');
      setInviteSuccess(`Invitation envoyée à ${invitation.email}.`);
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Impossible d’envoyer l’invitation.');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SellerPageHeader title="Gestion de l’équipe" description="Gérez les membres, leurs rôles et les invitations de votre boutique." />

      {loadError && (
        <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <button type="button" onClick={() => void loadTeam()} className="font-semibold underline">Réessayer</button>
        </div>
      )}

      {canManageTeam && <SellerCard title="Inviter un collaborateur">
        <form onSubmit={invite} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
          <div>
            <label htmlFor="team-email" className="block text-xs font-semibold text-gray-700 mb-1.5">Adresse email</label>
            <input
              id="team-email"
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
            />
          </div>
          <div>
            <label htmlFor="team-role" className="block text-xs font-semibold text-gray-700 mb-1.5">Rôle</label>
            <select
              id="team-role"
              value={role}
              onChange={event => setRole(event.target.value as InviteRole)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
            >
              {ROLES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <SellerActionButton type="submit" variant="primary" disabled={inviting || !email.trim()}>
            {inviting ? 'Invitation…' : 'Inviter'}
          </SellerActionButton>
        </form>
        {inviteError && <p role="alert" className="mt-4 text-sm text-rose-700">{inviteError}</p>}
        {inviteSuccess && <p role="status" className="mt-4 text-sm text-emerald-700">{inviteSuccess}</p>}
      </SellerCard>}

      <SellerCard title="Accès à la boutique">
        {loading ? (
          <div role="status" aria-label="Chargement de l’équipe" className="flex justify-center py-12"><Spinner size="md" /></div>
        ) : members.length === 0 ? (
          <SellerEmptyState title="Aucun membre" description="Aucun accès actif n’a été retourné par le serveur." />
        ) : (
          <div className="divide-y divide-gray-100">
            {members.map(member => (
              <div key={member.id} className="py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-brand-navy">{member.name || member.email}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">{member.role}</span>
                    {member.status && <span className="text-xs text-gray-500">{member.status}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{member.email}</p>
                  {member.joinedAt && <p className="text-xs text-gray-400 mt-1">Membre depuis le {new Date(member.joinedAt).toLocaleDateString('fr-FR')}</p>}
                </div>
                <div className="sm:max-w-md">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Permissions</p>
                  {member.permissions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {member.permissions.map(permission => (
                        <span key={permission} className="px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs">{permission}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">Aucune permission détaillée retournée.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SellerCard>

      <SellerCard title="Invitations en attente">
        {invitations.length === 0 ? (
          <SellerEmptyState title="Aucune invitation" description="Aucune invitation en attente n’a été retournée par le serveur." />
        ) : (
          <div className="divide-y divide-gray-100">
            {invitations.map(invitation => (
              <div key={invitation.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-brand-navy">{invitation.email}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Rôle : {invitation.role}</p>
                </div>
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">{invitation.status}</span>
              </div>
            ))}
          </div>
        )}
      </SellerCard>
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { UserCircleIcon, PlusIcon, XMarkIcon, MagnifyingGlassIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';
import { AdminService } from '../../config/api';

interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  activeSessions: number;
  totalOrders: number;
  seller?: { id: string; storeName: string; status: string };
  customer?: { id: string; firstName: string; lastName: string; phone: string };
}

interface UsersManagerProps {
  token: string;
  currentRole: string;
}

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-red-100 text-red-800 border-red-200',
  manager: 'bg-purple-100 text-purple-800 border-purple-200',
  seller: 'bg-orange-100 text-orange-800 border-orange-200',
  customer: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  user: 'bg-blue-100 text-blue-800 border-blue-200',
};

export default function UsersManager({ token, currentRole }: UsersManagerProps) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Formulaire de création
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'manager' | 'admin'>('manager');
  const [submitting, setSubmitting] = useState(false);

  // État d'audit modal
  const [selectedUserAudit, setSelectedUserAudit] = useState<{ user: UserAccount; logs: any[] } | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  // Notifications
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await AdminService.getUsers(page, 20, search || undefined, roleFilter || undefined);
      setUsers(res?.users || []);
      setTotalPages(res?.pagination?.pages || 1);
      setTotalCount(res?.pagination?.total || 0);
    } catch (err: any) {
      console.error('Erreur chargement utilisateurs:', err);
      setErrorMessage('Impossible de charger les utilisateurs depuis le serveur.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      await AdminService.createUser({
        name: formName.trim() || undefined,
        email: formEmail.trim(),
        password: formPassword,
        role: formRole,
      });

      setSuccessMessage(`Compte "${formEmail}" créé avec succès en tant que ${formRole}.`);
      setFormName('');
      setFormEmail('');
      setFormPassword('');
      setFormRole('manager');
      setShowCreateForm(false);
      setPage(1);
      await fetchUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'Impossible de créer le compte.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (userId: string, currentRole: string, newRole: string) => {
    if (currentRole === newRole) return;
    if (!window.confirm(`Confirmez-vous le passage de cet utilisateur au rôle "${newRole}" ?`)) return;

    try {
      await AdminService.updateUserRole(userId, newRole);
      setSuccessMessage(`Rôle mis à jour avec succès vers "${newRole}".`);
      await fetchUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors du changement de rôle.');
    }
  };

  const handleRevokeSessions = async (userId: string, email: string) => {
    if (!window.confirm(`Voulez-vous révoquer immédiatement toutes les sessions actives pour ${email} ? L'utilisateur sera déconnecté sur tous ses appareils.`)) return;

    try {
      await AdminService.revokeUserSessions(userId);
      setSuccessMessage(`Sessions révoquées pour ${email}.`);
      await fetchUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la révocation des sessions.');
    }
  };

  const handleViewAudit = async (user: UserAccount) => {
    try {
      setAuditLoading(true);
      setSelectedUserAudit({ user, logs: [] });
      const logs = await AdminService.getUserAudit(user.id);
      setSelectedUserAudit({ user, logs: Array.isArray(logs) ? logs : [] });
    } catch (err: any) {
      console.error('Erreur audit logs:', err);
      setErrorMessage('Impossible de récupérer l’historique d’audit pour cet utilisateur.');
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <UserCircleIcon className="w-6 h-6 text-orange-500" />
            Gestion des Utilisateurs &amp; Privilèges
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Contrôle d'accès RBAC, gestion des rôles, sécurité des sessions et journal d'audit ({totalCount} utilisateurs au total).
          </p>
        </div>

        {currentRole === 'admin' && (
          <button
            type="button"
            onClick={() => {
              setShowCreateForm((v) => !v);
              setSuccessMessage('');
              setErrorMessage('');
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-xl text-sm font-semibold hover:bg-orange-700 shadow-sm transition"
          >
            {showCreateForm ? (
              <>
                <XMarkIcon className="w-4 h-4" />
                Fermer le formulaire
              </>
            ) : (
              <>
                <PlusIcon className="w-4 h-4" />
                + Créer un utilisateur
              </>
            )}
          </button>
        )}
      </div>

      {/* Messages de retour */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800 flex justify-between items-center">
          <span>{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage('')} className="font-bold">✕</button>
        </div>
      )}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-800 flex justify-between items-center">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage('')} className="font-bold">✕</button>
        </div>
      )}

      {/* Formulaire de création */}
      {showCreateForm && currentRole === 'admin' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-4">Création d'un nouveau compte</h3>
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nom complet</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Fatoumata Diarra"
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Adresse email</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="utilisateur@mandemarket.com"
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Mot de passe temporaire</label>
                <input
                  type="password"
                  required
                  minLength={12}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Min. 12 caractères"
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Rôle accordé</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as any)}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                >
                  <option value="manager">Manager Opérationnel</option>
                  <option value="admin">Super Administrateur</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700 disabled:opacity-50 transition shadow-sm"
              >
                {submitting ? 'Création...' : 'Créer l’utilisateur'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Barre de filtre et de recherche */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500">Filtrer par rôle :</label>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs font-semibold border border-gray-200 rounded-lg px-3 py-1.5 outline-none bg-white focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Tous les rôles ({totalCount})</option>
            <option value="admin">Administrateurs</option>
            <option value="manager">Managers</option>
            <option value="seller">Vendeurs</option>
            <option value="customer">Clients enregistrés</option>
            <option value="user">Utilisateurs standards</option>
          </select>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou email..."
              className="w-full pl-9 pr-3.5 py-1.5 text-xs border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
            />
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-2.5 top-2" />
          </div>
          <button
            type="submit"
            className="px-3.5 py-1.5 text-xs font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-800"
          >
            Filtrer
          </button>
        </form>
      </div>

      {/* Table des utilisateurs */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-500">Chargement des utilisateurs réels...</div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">Aucun utilisateur ne correspond aux critères.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/75">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Utilisateur</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rôle</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Activité</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sessions</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-800 font-bold flex items-center justify-center text-xs">
                          {u.name ? u.name.slice(0, 2).toUpperCase() : u.email.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-gray-900">{u.name}</p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                          <p className="text-[11px] text-gray-400">Inscrit le {new Date(u.createdAt).toLocaleDateString('fr-FR')}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <select
                        value={u.role}
                        disabled={currentRole !== 'admin'}
                        onChange={(e) => handleRoleChange(u.id, u.role, e.target.value)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full border outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 ${
                          ROLE_BADGE[u.role] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        <option value="user">user</option>
                        {u.customer && <option value="customer">customer</option>}
                        {u.seller && <option value="seller">seller</option>}
                        <option value="manager">manager</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>

                    <td className="px-4 py-3.5 text-xs text-gray-600">
                      {u.seller ? (
                        <span className="text-orange-700 font-medium">Boutique: {u.seller.storeName}</span>
                      ) : u.totalOrders > 0 ? (
                        <span>{u.totalOrders} commande(s) passée(s)</span>
                      ) : (
                        <span className="text-gray-400">Aucune commande</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        u.activeSessions > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {u.activeSessions} active(s)
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleViewAudit(u)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
                        >
                          Audit
                        </button>
                        {currentRole === 'admin' && u.activeSessions > 0 && (
                          <button
                            type="button"
                            onClick={() => handleRevokeSessions(u.id, u.email)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition flex items-center gap-1"
                            title="Révoquer toutes les sessions de cet utilisateur"
                          >
                            <ShieldExclamationIcon className="w-3.5 h-3.5" />
                            Révoquer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Page {page} sur {totalPages} ({totalCount} utilisateurs)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 text-xs font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
              >
                Précédent
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 text-xs font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal d'audit */}
      {selectedUserAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Journal d'audit : {selectedUserAudit.user.name}
                </h3>
                <p className="text-xs text-gray-500">{selectedUserAudit.user.email} · ID: {selectedUserAudit.user.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserAudit(null)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-600"
              >
                ✕
              </button>
            </div>

            {auditLoading ? (
              <div className="py-8 text-center text-xs text-gray-500">Chargement de l'audit...</div>
            ) : selectedUserAudit.logs.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">Aucun événement de sécurité consigné pour ce compte.</div>
            ) : (
              <div className="divide-y divide-gray-100 text-xs space-y-2">
                {selectedUserAudit.logs.map((log: any) => (
                  <div key={log.id} className="pt-2 first:pt-0 space-y-0.5">
                    <div className="flex items-center justify-between font-semibold text-gray-800">
                      <span>{log.action}</span>
                      <span className="text-[10px] text-gray-400 font-normal">
                        {new Date(log.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {log.details && (
                      <pre className="p-2 bg-gray-50 rounded text-[11px] text-gray-600 overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedUserAudit(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

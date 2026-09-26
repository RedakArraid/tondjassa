'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DocumentTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { AdminService } from '../../config/api';

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  details?: any;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    name?: string;
    role: string;
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function AuditLogsManager() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await AdminService.getAuditLogs(
        page,
        25,
        entityFilter || undefined,
        actionFilter || undefined
      );
      setLogs(res.logs || []);
      setPagination(res.pagination || null);
    } catch (err) {
      console.error('Erreur journal d’audit:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, entityFilter, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheckIcon className="w-6 h-6 text-orange-600" />
            Journal d’audit système & conformité
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Traçabilité immuable des actions sensibles (rôles, révocations, approbations, remboursements).
          </p>
        </div>

        <button
          onClick={() => fetchLogs()}
          disabled={loading}
          className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-600 self-start sm:self-center"
          title="Rafraîchir"
        >
          <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-gray-200">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Entité
          </label>
          <select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Toutes les entités</option>
            <option value="User">Utilisateur (User)</option>
            <option value="ReturnRequest">Demande de retour (ReturnRequest)</option>
            <option value="Review">Avis client (Review)</option>
            <option value="Order">Commande (Order)</option>
            <option value="Seller">Vendeur (Seller)</option>
            <option value="Payout">Versement (Payout)</option>
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Action spécifique
          </label>
          <input
            type="text"
            placeholder="Ex: ADMIN_USER_ROLE_UPDATED..."
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Table des logs */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900">Aucun enregistrement d'audit</h3>
          <p className="text-xs text-gray-500 mt-1">
            Aucun événement ne correspond aux filtres spécifiés.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Horodatage</th>
                  <th className="px-4 py-3">Acteur</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entité & ID</th>
                  <th className="px-4 py-3 text-right">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">
                        {log.user?.email || 'Système'}
                      </p>
                      {log.user?.role && (
                        <span className="inline-block px-1.5 py-0.2 bg-gray-100 rounded text-[10px] text-gray-600 font-medium">
                          {log.user.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-100">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <span className="font-medium text-gray-900">{log.entity}</span>
                      <span className="font-mono text-[11px] text-gray-400 block truncate max-w-[150px]">
                        {log.entityId}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {log.details ? (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[11px] font-medium transition-colors"
                        >
                          Examiner
                        </button>
                      ) : (
                        <span className="text-gray-400 text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Page {pagination.page} sur {pagination.pages} ({pagination.total} événements enregistrés)
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  aria-label="Page précédente du journal d’audit"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  aria-label="Page suivante du journal d’audit"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Détails JSON */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Détails de l'événement d'audit</h3>
                <p className="font-mono text-xs text-orange-600">{selectedLog.action}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs">
                <p>
                  <strong>Acteur :</strong> {selectedLog.user?.email || 'Système'} ({selectedLog.user?.role || 'N/A'})
                </p>
                <p className="mt-1">
                  <strong>Entité cible :</strong> {selectedLog.entity} (#{selectedLog.entityId})
                </p>
                <p className="mt-1">
                  <strong>Date :</strong> {new Date(selectedLog.createdAt).toLocaleString('fr-FR')}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">Charge utile JSON (Payload) :</p>
                <pre className="bg-gray-900 text-gray-100 p-3.5 rounded-xl text-[11px] overflow-x-auto font-mono leading-relaxed">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 mt-4 text-right">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-colors"
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

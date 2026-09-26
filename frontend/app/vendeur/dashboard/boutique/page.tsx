'use client';

import { useEffect, useState } from 'react';
import { SellerService } from '../../../config/api';
import { Spinner } from '../_components/sections';
import { SellerPageHeader, SellerHeaderActions, SellerActionButton, SellerCard } from '../_components/ui';
import { useSellerAccess } from '../_components/access';

export default function BoutiqueProfilPage() {
  const { can } = useSellerAccess();
  const canWrite = can('settings.write');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [form, setForm] = useState({ storeName:'', description:'', phone:'', email:'', address:'', hours:'', social:'' });

  useEffect(() => {
    SellerService.getMyProfile().then(p => {
      setProfile(p);
      setForm({
        storeName: p?.storeName || '',
        description: p?.description || '',
        phone: p?.phone || '',
        email: p?.email || '',
        address: p?.address || '',
        hours: p?.hours || '',
        social: p?.social || '',
      });
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  const storeHref = profile?.slug ? `/vendeur/${profile.slug}` : '/vendeur/dashboard/boutique';

  return (
    <div className="space-y-4">
      <SellerPageHeader title="Profil boutique" description="Informations publiques de votre boutique." action={
        <SellerHeaderActions>
          <SellerActionButton href={storeHref} variant="secondary">Voir ma boutique</SellerActionButton>
          {canWrite && (!editing ? (
            <SellerActionButton variant="primary" onClick={() => setEditing(true)}>Modifier</SellerActionButton>
          ) : (
            <>
              <SellerActionButton variant="primary" onClick={async () => { try { await SellerService.updateMyProfile(form); setEditing(false); alert('Enregistré'); } catch(e:any){ alert(e.message);} }}>Enregistrer</SellerActionButton>
              <SellerActionButton variant="outline" onClick={() => setEditing(false)}>Annuler</SellerActionButton>
            </>
          ))}
        </SellerHeaderActions>
      } />
      <SellerCard>
        <div className="grid md:grid-cols-2 gap-3 max-w-3xl">
          {[['Nom de boutique','storeName'],['Téléphone','phone'],['Email','email'],['Adresse','address'],['Horaires','hours'],['Réseaux sociaux','social']].map(([label,key]) => (
            <div key={key}>
              <label className="text-xs font-semibold text-gray-500">{label}</label>
              <input disabled={!editing} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-50" value={(form as any)[key]} onChange={(e)=>setForm(f=>({...f,[key]:e.target.value}))} />
            </div>
          ))}
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-gray-500">Description</label>
            <textarea disabled={!editing} rows={4} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-50" value={form.description} onChange={(e)=>setForm(f=>({...f,description:e.target.value}))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Catégorie</label>
            <input disabled className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-gray-50" value="Général" />
          </div>
        </div>
      </SellerCard>
    </div>
  );
}

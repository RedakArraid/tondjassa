'use client';

import { createContext, useContext, useMemo } from 'react';

type SellerAccessValue = {
  permissions: string[];
  isOwner: boolean;
  can: (permission: string) => boolean;
};

const SellerAccessContext = createContext<SellerAccessValue>({
  permissions: [],
  isOwner: false,
  can: () => false,
});

export function SellerAccessProvider({ permissions, isOwner, children }: {
  permissions: string[];
  isOwner: boolean;
  children: React.ReactNode;
}) {
  const value = useMemo<SellerAccessValue>(() => ({
    permissions,
    isOwner,
    can: (permission: string) => permissions.includes('*') || permissions.includes(permission),
  }), [isOwner, permissions]);

  return <SellerAccessContext.Provider value={value}>{children}</SellerAccessContext.Provider>;
}

export function useSellerAccess() {
  return useContext(SellerAccessContext);
}

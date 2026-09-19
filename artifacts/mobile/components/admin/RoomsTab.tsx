import React from 'react';
import AdminAccountScreen from '@/app/admin/account';

type Props = { bottomPadding: number };

/**
 * Account tab — renders the full account screen (display name, password,
 * sign out, delete account, legal links) inline, matching the web Account tab.
 * The same screen is reachable as a pushed route from the header person icon.
 */
export function RoomsTab({ bottomPadding }: Props) {
  return <AdminAccountScreen embedded bottomPadding={bottomPadding} />;
}

import { requireAdmin } from '@/lib/auth';
import { t } from '@/lib/t';
import { listUsers } from '@/services/user.service';
import { UsersTable } from './users-table';
import { CreateUserDialog } from './create-user-dialog';

/**
 * Reference page for the services → actions → UI pattern.
 * Server component: fetches through the service, renders client islands for
 * interaction.
 *
 * Auth is checked here as well as in ../layout.tsx: Next.js renders layouts
 * and pages in parallel, so a page must guard its own data access. The check
 * is cached per request, so the second call costs nothing.
 */
export default async function AdminUsersPage() {
  await requireAdmin();
  const users = await listUsers();

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('users.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('users.subtitle')}</p>
        </div>
        <CreateUserDialog />
      </div>

      <UsersTable users={users} />
    </div>
  );
}

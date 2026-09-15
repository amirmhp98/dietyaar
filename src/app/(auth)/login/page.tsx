import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  // A valid session goes straight to the dashboard. A stale cookie stays here
  // and is overwritten on the next successful login, so there is no redirect loop.
  const user = await getSession();
  if (user) redirect('/');

  return <LoginForm />;
}

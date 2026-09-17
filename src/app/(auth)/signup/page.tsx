import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { SignUpForm } from './signup-form';

export default async function SignUpPage() {
  const user = await getSession();
  if (user) redirect('/');
  return <SignUpForm />;
}

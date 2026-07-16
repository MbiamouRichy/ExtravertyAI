import AccountPage from '@/components/dashboard/user/compte'
import { getUser } from '@/lib/auth-server';
import { redirect } from 'next/navigation';

async function UserPage() {
    const user = await getUser(); // Get the user from the server-side session
  
    if (!user) {
      redirect("/sign-in");
    }
  return <AccountPage/>
}

export default UserPage 

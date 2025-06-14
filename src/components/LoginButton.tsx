'use client';

import { usePrivy } from '@privy-io/react-auth';

export default function LoginButton() {
  const { login, logout, authenticated, user, ready } = usePrivy();

  if (!ready) {
    return (
      <button className="bg-purple-600 text-white px-4 py-2 rounded-lg opacity-50 cursor-not-allowed">
        Loading...
      </button>
    );
  }

  if (authenticated) {
    const displayName = String(user?.email || user?.wallet?.address || 'User');
    
    return (
      <div className="space-y-4">
        <div className="bg-purple-100 p-4 rounded-lg">
          <p className="text-purple-900">
            Welcome, {displayName}!
          </p>
        </div>
        <button
          onClick={logout}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
    >
      Login with Privy
    </button>
  );
} 
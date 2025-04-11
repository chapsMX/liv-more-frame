'use client';

import { useEffect, useState } from 'react';
import Goals from '@/components/Goals';

export default function GoalsPage() {
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getUserInfo = async () => {
      try {
        // Get user info from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const userFid = urlParams.get('fid');

        if (!userFid) {
          console.error('No user FID provided');
          window.location.href = '/';
          return;
        }

        // Fetch user info
        const response = await fetch(`/api/neynar?fid=${userFid}`);
        const data = await response.json();

        if (data.success && data.user) {
          setDisplayName(data.user.display_name || data.user.username);
        } else {
          console.error('Failed to fetch user info');
          window.location.href = '/';
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
        window.location.href = '/';
      } finally {
        setIsLoading(false);
      }
    };

    getUserInfo();
  }, []);

  const handleSaveGoals = async (goals: { steps: number; sleep: number; calories: number }) => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const userFid = urlParams.get('fid');

      const response = await fetch('/api/goals/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_fid: userFid,
          ...goals
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to main app view
        window.location.href = `/?fid=${userFid}`;
      } else {
        console.error('Failed to save goals:', data.error);
      }
    } catch (error) {
      console.error('Error saving goals:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return <Goals onSave={handleSaveGoals} displayName={displayName} />;
} 
'use client';

import { useEffect, useState } from 'react';
import Goals from '@/components/Goals';

export default function GoalsPage() {
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [userFid, setUserFid] = useState('');

  useEffect(() => {
    const getUserInfo = async () => {
      try {
        // Get user info from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const fid = urlParams.get('fid');

        if (!fid) {
          console.error('No user FID provided');
          window.location.href = '/';
          return;
        }

        setUserFid(fid);

        // Fetch user info
        const response = await fetch(`/api/neynar?fid=${fid}`);
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

  const handleSaveGoals = async () => {
    try {
      const response = await fetch('/api/goals/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-fid': userFid
        },
        body: JSON.stringify({
          steps: 10000,
          calories: 2500,
          sleep: 8
        })
      });

      const data = await response.json();

      if (data.success) {
        window.location.href = `/?fid=${userFid}`;
      } else {
        throw new Error(data.error || 'Error al guardar los objetivos');
      }
    } catch (error) {
      console.error('Error saving goals:', error);
      throw error;
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

  return <Goals 
    onSave={handleSaveGoals} 
    displayName={displayName}
    userFid={userFid}
  />;
} 
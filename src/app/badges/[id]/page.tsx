"use client";

import { protoMono } from '../../../styles/fonts';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useUser } from '../../../context/UserContext';
import { sdk } from "@farcaster/miniapp-sdk";

// Update the Badge type to include earned_by
type BadgeDetail = {
  id: number;
  name: string;
  description: string;
  badge_type: string;
  category: string;
  image_url: string;
  total_supply: number;
  total_earned: number;
  created_at: string;
  earned_by: Array<{
    fid: number;
    display_name?: string;
    username?: string;
    pfp_url?: string;
  }>;
};

export default function BadgeDetail() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;
  const { userState } = useUser();
  const [badge, setBadge] = useState<BadgeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pfpUrl, setPfpUrl] = useState<string>();

  useEffect(() => {
    const loadUserProfile = async () => {
      const context = await sdk.context;
      if (context.user?.pfpUrl) {
        setPfpUrl(context.user.pfpUrl);
      }
    };

    loadUserProfile();
  }, []);

  useEffect(() => {
    const fetchBadge = async () => {
      try {
        const response = await fetch(`/api/badges/${id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch badge');
        }
        const data = await response.json();
        setBadge(data.badge);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) fetchBadge();
  }, [id]);

  if (isLoading) {
    return (
      <div className={`min-h-screen bg-black text-white ${protoMono.className}`}>
        <div className="container mx-auto px-4 py-8">
          <p className="text-center text-gray-400">Loading badge details...</p>
        </div>
      </div>
    );
  }

  if (error || !badge) {
    return (
      <div className={`min-h-screen bg-black text-white ${protoMono.className}`}>
        <div className="container mx-auto px-4 py-8">
          <p className="text-center text-red-400">{error || 'Badge not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-black text-white ${protoMono.className}`}>
      <div className="container mx-auto px-4 py-2">
        {/* Header */}
        <div className="flex justify-between items-center w-full max-w-2xl mx-auto mb-2">
          <div className="flex items-center">
            <Image
              src="/livMore_w.png"
              alt="Liv More"
              width={60}
              height={60}
              priority
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2 py-1 bg-gray-800 rounded-full text-white min-w-[150px] border-2 border-gray-700">
              {pfpUrl && (
                <Image
                  src={pfpUrl}
                  alt="Profile"
                  width={32}
                  height={32}
                  className="rounded-full border-2 border-gray-700"
                  unoptimized
                />
              )}
              <span className={`text-base font-semibold ${protoMono.className}`}>
                {userState.username}
              </span>
              <button
                onClick={() => router.push('/badges')}
                className="ml-2 text-gray-400 hover:text-white transition-colors"
                aria-label="Back"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 19l-7-7 7-7" />
                  <path d="M3 12h18" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-col items-center justify-center space-y-6 p-0">
          <div className="w-full max-w-6xl bg-gray-900 border-2 border-gray-700 rounded-xl p-6">
            <div className="flex flex-col items-center mb-2">
              <div className="relative w-48 h-48 mb-0">
                <Image
                  src={badge.image_url}
                  alt={badge.name}
                  fill
                  className="object-cover rounded-lg"
                  unoptimized
                />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">{badge.name}</h1>
              <div className="flex gap-2 mb-2">
                <span className="px-3 py-1 bg-violet-600 rounded-full text-sm">
                  {badge.badge_type}
                </span>
                <span className="px-3 py-1 bg-gray-700 rounded-full text-sm">
                  {badge.category}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white mb-2">Description:</h2>
                <p className="text-gray-300">{badge.description}</p>
              </div>

              {/* List of users who earned the badge */}
              <div className="mb-6">
                <div className="text-sm text-violet-300 font-bold mb-2">Earned by:</div>
                {badge.earned_by && badge.earned_by.length > 0 ? (
                  <div className="flex flex-row flex-wrap gap-4">
                    {badge.earned_by.map((user: { fid: number; display_name?: string; username?: string; pfp_url?: string; }) => (
                      <div key={user.fid} className="flex flex-col items-center w-16">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-700 mb-1 bg-gray-800">
                          {user.pfp_url ? (
                            <Image
                              src={user.pfp_url}
                              alt={user.display_name || user.username || String(user.fid)}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 text-xl">?</div>
                          )}
                        </div>
                        <div className="text-xs text-center truncate max-w-[56px]">
                          {user.display_name || user.username || user.fid}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-xs">No users have earned this badge yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
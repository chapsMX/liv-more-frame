"use client";

import { protoMono } from '../../../styles/fonts';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Badge } from '../../../types/badge';
import { useUser } from '../../../context/UserContext';
import sdk from "@farcaster/frame-sdk";

export default function BadgeDetail() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;
  const { userState } = useUser();
  const [badge, setBadge] = useState<Badge | null>(null);
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
        <div className="flex flex-col items-center justify-center space-y-6 p-2">
          <div className="w-full max-w-2xl bg-gray-900 border-2 border-gray-700 rounded-xl p-6">
            <div className="flex flex-col items-center mb-6">
              <div className="relative w-32 h-32 mb-4">
                <Image
                  src={badge.image_url}
                  alt={badge.name}
                  fill
                  className="object-cover rounded-lg"
                  unoptimized
                />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">{badge.name}</h1>
              <div className="flex gap-2 mb-4">
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
                <h2 className="text-lg font-semibold text-white mb-2">Description</h2>
                <p className="text-gray-300">{badge.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white mb-2">Total Supply</h2>
                  <p className="text-gray-300">{badge.total_supply}</p>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white mb-2">Total Earned</h2>
                  <p className="text-gray-300">{badge.total_earned || 0}</p>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-white mb-2">Created</h2>
                <p className="text-gray-300">
                  {new Date(badge.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
"use client";

import { protoMono } from '../styles/fonts';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useUser } from '../context/UserContext';
import { AddFrameIcon } from '../styles/svg';
import { useEffect, useState } from 'react';
import sdk from "@farcaster/frame-sdk";

// Helper para calcular fecha de finalización
function getEndDate(startDate: string, durationDays: number) {
  const start = new Date(startDate);
  start.setDate(start.getDate() + durationDays);
  return start.toLocaleDateString();
}

export default function Challenges() {
  const router = useRouter();
  const { userState } = useUser();
  type Challenge = {
    id: number;
    title: string;
    description: string;
    activity_type: string;
    objective_type: string;
    goal_amount: number;
    duration_days: number;
    start_date: string;
    image_url: string;
    is_official: boolean;
    points_value: number | null;
    badge_id: number | null;
    entry_cost: number | null;
  };
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [pfpUrl, setPfpUrl] = useState<string>();
  const [myChallenges, setMyChallenges] = useState<Challenge[]>([]);
  const [loadingMyChallenges, setLoadingMyChallenges] = useState(true);

  useEffect(() => {
    const fetchChallenges = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/challenges');
        const data = await res.json();
        setChallenges(data.challenges || []);
      } catch {
        setChallenges([]);
      } finally {
        setLoading(false);
      }
    };
    fetchChallenges();
  }, []);

  useEffect(() => {
    const fetchMyChallenges = async () => {
      setLoadingMyChallenges(true);
      try {
        if (userState.userFid) {
          console.log('[MyChallenges] userFid:', userState.userFid);
          const joinedRes = await fetch(`/api/challenges/joined?fid=${userState.userFid}`);
          const raw = await joinedRes.clone().text();
          console.log('[MyChallenges] Raw response:', raw);
          const joinedData = await joinedRes.json();
          console.log('[MyChallenges] joinedData.challenges:', joinedData.challenges);
          setMyChallenges(joinedData.challenges || []);
          setTimeout(() => {
            console.log('[MyChallenges] myChallenges after set:', joinedData.challenges || []);
          }, 100);
        } else {
          setMyChallenges([]);
        }
      } catch {
        setMyChallenges([]);
      } finally {
        setLoadingMyChallenges(false);
      }
    };
    fetchMyChallenges();
  }, [userState.userFid]);

  useEffect(() => {
    const loadUserProfile = async () => {
      const context = await sdk.context;
      if (context.user?.pfpUrl) {
        setPfpUrl(context.user.pfpUrl);
      }
    };

    loadUserProfile();
  }, []);

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
                onClick={() => router.push('/dashboard')}
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
        <div className="flex flex-col items-center jusese etify-center space-y-6 p-2">
          <h1 className="text-2xl font-bold text-white mb-2">Open Challenges</h1>

          {/* Carrousel de Open Challenges */}
          <div className="w-full max-w-2xl overflow-x-auto pb-2">
            <div className="flex flex-row gap-4 snap-x snap-mandatory overflow-x-auto px-1">
              {loading ? (
                <div className="text-gray-400 text-center py-8">Loading challenges...</div>
              ) : challenges.length === 0 ? (
                <div className="text-gray-400 text-center py-8">No challenges available yet.</div>
              ) : (
                challenges.map((challenge) => (
                  <div
                    key={challenge.id}
                    className="min-w-[160px] max-w-xs bg-gray-900 border-2 border-gray-700 rounded-xl p-2 flex flex-col items-center shadow-lg cursor-pointer hover:border-violet-700 transition-colors snap-center"
                    onClick={() => router.push(`/challenges/${challenge.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter') router.push(`/challenges/${challenge.id}`); }}
                  >
                    {challenge.image_url && (
                      <div className="flex-shrink-0 mb-2">
                        <Image
                          src={challenge.image_url}
                          alt={challenge.title || 'Challenge'}
                          width={80}
                          height={80}
                          className="rounded-lg border border-gray-700 object-cover"
                          unoptimized
                        />
                      </div>
                    )}
                    <div className="flex-1 w-full flex flex-col items-center">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-white py-0 text-center m-0">{challenge.title}</span>
                        {challenge.is_official && (
                          <span className="ml-2 px-2 py-0.5 text-xs rounded bg-violet-700 text-white font-semibold">Official</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 text-xs text-gray-300 mb-0 justify-left w-full">
                        <span className="px-1 py-0">Activity: {challenge.activity_type}</span>
                        <span className="px-1 py-0">Start: {challenge.start_date ? new Date(challenge.start_date).toLocaleDateString() : '-'}</span>
                        {challenge.entry_cost !== null && (
                          <span className="bg-gray-800 px-2 py-1 rounded">Entry cost: {challenge.entry_cost}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* My Challenges */}
          <h2 className="text-xl font-bold text-white mt-0 mb-2">My Challenges</h2>
          <div className="w-full max-w-2xl flex flex-col gap-2">
            {loadingMyChallenges ? (
              <div className="text-gray-400 text-center py-4">Loading your challenges...</div>
            ) : myChallenges.length === 0 ? (
              <div className="text-gray-400 text-center py-4">You haven&apos;t joined any challenges yet.</div>
            ) : (
              myChallenges
                
                .map((challenge) => (
                  <div
                    key={challenge.id}
                    className="flex items-center justify-between bg-gray-900 border-2 border-gray-700 rounded-xl p-2 shadow cursor-pointer hover:border-violet-700 transition-colors"
                    onClick={() => router.push(`/challenges/${challenge.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter') router.push(`/challenges/${challenge.id}`); }}
                  >
                    <span className="text-base font-semibold text-white">{challenge.title}</span>
                    <span className="text-xs text-gray-400">Ends: {getEndDate(challenge.start_date, challenge.duration_days)}</span>
                  </div>
                ))
            )}
          </div>
        </div>
        {/* Botón para crear reto */}
        <div className="flex justify-center gap-4">
          {userState.can_create && (
            <>
              <button
                onClick={() => router.push('/challengescreate')}
                className="flex items-center gap-2 px-6 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-white font-bold border-2 border-violet-700 transition-colors mb-4"
              >
                <AddFrameIcon className="w-5 h-5" />
                Challenges
              </button> <br />
              <button
                onClick={() => router.push('/badges')}
                className="flex items-center gap-2 px-6 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-white font-bold border-2 border-violet-700 transition-colors mb-4"
              >
                <AddFrameIcon className="w-5 h-5" />
                Badges
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

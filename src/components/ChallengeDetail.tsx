"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { useUser } from '../context/UserContext';
import { protoMono } from '../styles/fonts';
import sdk from "@farcaster/frame-sdk";

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
  visible?: boolean;
  challenge_status?: string;
  participants?: number[];
};

type Participant = {
  fid: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
};

export default function ChallengeDetail() {
  const router = useRouter();
  const params = useParams();
  const { userState } = useUser();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinStatus, setJoinStatus] = useState<'idle' | 'joining' | 'joined' | 'error'>("idle");
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [alreadyJoined, setAlreadyJoined] = useState(false);
  const [pfpUrl, setPfpUrl] = useState<string>();

  useEffect(() => {
    const fetchChallenge = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/challenges/${params.id}`);
        const data = await res.json();
        if (res.ok) {
          setChallenge(data.challenge);
          // Fetch participant info (bulk)
          if (data.challenge.participants && data.challenge.participants.length > 0) {
            const fids = data.challenge.participants.slice(0, 10); // max 10
            const userRes = await fetch(`/api/neynar?fids=${fids.join(',')}`);
            const userData = await userRes.json();
            setParticipants(userData.users || []);
            // Check if current user is already joined
            setAlreadyJoined(
              data.challenge.participants.map(String).includes(String(userState.userFid))
            );
          } else {
            setParticipants([]);
            setAlreadyJoined(false);
          }
        } else {
          setError(data.error || 'Challenge not found');
        }
      } catch {
        setError('Error loading challenge');
      } finally {
        setLoading(false);
      }
    };
    if (params.id) fetchChallenge();
  }, [params.id, userState.userFid]);

  useEffect(() => {
    const loadUserProfile = async () => {
      const context = await sdk.context;
      if (context.user?.pfpUrl) {
        setPfpUrl(context.user.pfpUrl);
      }
    };

    loadUserProfile();
  }, []);

  const handleJoin = async () => {
    setJoinStatus('joining');
    setError(null);
    try {
      const res = await fetch('/api/challenges/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: params.id, user_fid: userState.userFid }),
      });
      const data = await res.json();
      if (res.ok) {
        setJoinStatus('joined');
      } else {
        setJoinStatus('error');
        setError(data.error || 'Could not join challenge');
      }
    } catch {
      setJoinStatus('error');
      setError('Could not join challenge');
    }
  };

  return (
    <div className={`min-h-screen bg-black text-white py-2 ${protoMono.className}`}>
      {/* Header fuera del recuadro */}
      <div className="flex justify-between items-center w-full max-w-2xl mb-2 px-4">
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
            <span className={`text-base font-semibold ${protoMono.className}`}>{userState.username}</span>
            <button
              onClick={() => router.push('/challenges')}
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
      {/* Recuadro principal más angosto y centrado */}
      <div className="flex justify-between items-center w-full max-w-2xl mb-8 px-4">
      <div className="w-full max-w-2xl mx-auto bg-gray-900 border-2 border-gray-700 rounded-xl p-6 shadow-2xl">
        {loading ? (
          <div className="text-gray-400 text-center py-8">Loading challenge...</div>
        ) : error ? (
          <div className="text-red-400 text-center py-8">{error}</div>
        ) : challenge ? (
          <>
            <div className="flex flex-col items-center mb-4">
              {challenge.image_url && (
                <Image
                  src={challenge.image_url}
                  alt={challenge.title || 'Challenge'}
                  width={160}
                  height={160}
                  className="rounded-lg border border-gray-700 object-cover mb-2"
                  unoptimized
                />
              )}
              <h2 className="text-2xl font-bold text-white mb-2">{challenge.title}</h2>
              {challenge.is_official && (
                <span className="px-2 py-0.5 text-xs rounded bg-violet-700 text-white font-semibold mb-2">Official</span>
              )}
              <div className="text-gray-400 text-center mb-2">{challenge.description}</div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-gray-300 mb-4 justify-center">
              <span className="bg-gray-800 px-2 py-1 rounded">Activity: {challenge.activity_type}</span>
              <span className="bg-gray-800 px-2 py-1 rounded">Objective: {challenge.objective_type}</span>
              <span className="bg-gray-800 px-2 py-1 rounded">Goal: {challenge.goal_amount}</span>
              <span className="bg-gray-800 px-2 py-1 rounded">Duration: {challenge.duration_days} days</span>
              <span className="bg-gray-800 px-2 py-1 rounded">Start: {challenge.start_date ? new Date(challenge.start_date).toLocaleDateString() : '-'}</span>
              {challenge.entry_cost !== null && (
                <span className="bg-gray-800 px-2 py-1 rounded">Entry cost: {challenge.entry_cost}</span>
              )}
            </div>
            {/* Participants */}
            <div className="mb-6">
              <div className="text-sm text-violet-300 font-bold mb-2">Participants</div>
              {participants.length === 0 ? (
                <div className="text-gray-500 text-xs">No participants yet.</div>
              ) : (
                <div className="flex flex-row flex-wrap gap-4">
                  {participants.map((user) => (
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
              )}
            </div>
            {alreadyJoined || joinStatus === 'joined' ? (
              <div className="text-green-400 text-center font-bold">You have joined this challenge!</div>
            ) : (
              <button
                onClick={handleJoin}
                disabled={joinStatus === 'joining'}
                className="w-full mt-4 px-4 py-2 text-sm font-bold text-white bg-violet-600 border-2 border-violet-700 rounded-md hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 transition-colors"
              >
                {joinStatus === 'joining' ? 'Joining...' : 'Join Challenge'}
              </button>
            )}
            {joinStatus === 'error' && (
              <div className="text-red-400 text-center mt-2">{error}</div>
            )}
          </>
        ) : null}
      </div>
      </div>
    </div>
  );
} 
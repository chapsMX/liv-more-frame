"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { useUser } from '../context/UserContext';
import { protoMono } from '../styles/fonts';
import sdk from "@farcaster/frame-sdk";
import { ShareIcon } from '@/styles/svg';

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


type InviteFriendsModalProps = {
  onInvite: (selectedFids: string[]) => void;
  onClose: () => void;
  currentFid: number;
};

function InviteFriendsModal({ onInvite, onClose, currentFid }: InviteFriendsModalProps) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<{ fid: number; username?: string; pfp_url?: string }[]>([]);
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    setLoading(true);
    setUsers([]);
    setSelected([]);
    fetch(`/api/neynar/replies?fid=${currentFid}&limit=20`)
      .then(res => res.json())
      .then(async data => {
        const seen = new Set<number>();
        const userList: { fid: number; username?: string; pfp_url?: string }[] = [];
        type NeynarProfile = { fid: number; username?: string; pfp_url?: string };
        type NeynarCast = {
          parent_author?: { fid?: number };
          mentioned_profiles?: NeynarProfile[];
        };
        (data.casts || []).forEach((cast: NeynarCast) => {
          if (cast.parent_author && cast.parent_author.fid && cast.parent_author.fid !== currentFid && !seen.has(cast.parent_author.fid)) {
            seen.add(cast.parent_author.fid);
            let userInfo = null;
            if (cast.mentioned_profiles) {
              userInfo = cast.mentioned_profiles.find((p: NeynarProfile) => p.fid === cast.parent_author!.fid);
            }
            userList.push({
              fid: cast.parent_author.fid,
              username: userInfo?.username,
              pfp_url: userInfo?.pfp_url
            });
          }
          (cast.mentioned_profiles || []).forEach((profile: NeynarProfile) => {
            if (profile.fid !== currentFid && !seen.has(profile.fid)) {
              seen.add(profile.fid);
              userList.push({ fid: profile.fid, username: profile.username, pfp_url: profile.pfp_url });
            }
          });
        });
        const limitedUsers = userList.slice(0, 10);
        const missingFids = limitedUsers.filter(u => !u.username || !u.pfp_url).map(u => u.fid);
        if (missingFids.length > 0) {
          const resp = await fetch(`/api/neynar/users?fids=${missingFids.join(',')}`);
          const profileData = await resp.json();
          if (profileData.users && Array.isArray(profileData.users)) {
            const profileMap = new Map<number, { username: string; pfp_url: string }>();
            profileData.users.forEach((user: NeynarProfile) => {
              profileMap.set(user.fid, { username: user.username || '', pfp_url: user.pfp_url || '' });
            });
            for (const u of limitedUsers) {
              if ((!u.username || !u.pfp_url) && profileMap.has(u.fid)) {
                const info = profileMap.get(u.fid)!;
                u.username = u.username || info.username;
                u.pfp_url = u.pfp_url || info.pfp_url;
              }
            }
          }
        }
        setUsers(limitedUsers);
      })
      .finally(() => setLoading(false));
  }, [currentFid]);

  function toggle(fid: number) {
    setSelected(sel => sel.includes(fid) ? sel.filter(f => f !== fid) : [...sel, fid]);
  }

  function handleInviteWithUsernames() {
    // Map selected FIDs to usernames (with fallback to fid if username missing)
    const mentions = selected.map(fid => {
      const user = users.find(u => u.fid === fid);
      return user?.username ? `@${user.username}` : `@fid:${fid}`;
    });
    onInvite(mentions);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-900 p-6 rounded-xl border-2 border-gray-700 max-w-md w-full">
        <h2 className="text-xl font-bold mb-2 text-white">Invite friends to your challenge</h2>
        <div className="flex flex-col gap-3 mb-2">
          {loading ? (
            <span className="text-gray-400">Loading users...</span>
          ) : users.length > 0 ? (
            users.map((user) => (
              <label key={user.fid} className="flex items-center gap-3 cursor-pointer">
                {user.pfp_url && (
                  <Image
                    src={user.pfp_url}
                    alt={user.username || 'User'}
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full border border-gray-700"
                    unoptimized
                  />
                )}
                <span className="text-white">{user.username || `User ${user.fid}`}</span>
                <input
                  type="checkbox"
                  checked={selected.includes(user.fid)}
                  onChange={() => toggle(user.fid)}
                  className="ml-auto"
                />
              </label>
            ))
          ) : (
            <span className="text-gray-400">No users found to invite.</span>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-700 rounded text-white">Cancel</button>
          <button
            onClick={handleInviteWithUsernames}
            className="px-4 py-2 bg-violet-600 rounded text-white font-bold"
            disabled={selected.length === 0}
          >
            Invite
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChallengeDetail() {
  const router = useRouter();
  const params = useParams();
  const challengeId = params?.id as string;
  const { userState } = useUser();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinStatus, setJoinStatus] = useState<'idle' | 'joining' | 'joined' | 'error'>("idle");
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [alreadyJoined, setAlreadyJoined] = useState(false);
  const [pfpUrl, setPfpUrl] = useState<string>();
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    const fetchChallenge = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/challenges/${challengeId}`);
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
            const isJoined = data.challenge.participants.map(String).includes(String(userState.userFid));
            setAlreadyJoined(isJoined);

            // If user is joined, trigger sync of activity data
            if (isJoined && userState.userFid) {
              const startDate = new Date(data.challenge.start_date);
              const challengeEndDate = new Date(startDate);
              challengeEndDate.setDate(startDate.getDate() + data.challenge.duration_days - 1);
              
              const today = new Date();
              const syncEndDate = challengeEndDate > today ? today : challengeEndDate;

              if (startDate <= today) {
                try {
                  console.log('🔄 [Sync] Syncing challenge data from', startDate.toISOString().split('T')[0], 'to', syncEndDate.toISOString().split('T')[0]);
                  
                  const syncRes = await fetch('/api/challenges/sync-history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      user_fid: userState.userFid,
                      challenge_id: challengeId,
                      start_date: startDate.toISOString().split('T')[0],
                      end_date: syncEndDate.toISOString().split('T')[0]
                    })
                  });
                  
                  if (!syncRes.ok) {
                    console.error('Error syncing challenge history:', await syncRes.text());
                  } else {
                    console.log('✅ [Sync] Challenge history synchronized successfully');
                  }
                } catch (syncError) {
                  console.error('Error triggering sync:', syncError);
                }
              } else {
                console.log('⚠️ [Sync] Challenge hasn\'t started yet, skipping sync');
              }
            }
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
    if (challengeId) fetchChallenge();
  }, [challengeId, userState.userFid]);

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
        body: JSON.stringify({ challenge_id: challengeId, user_fid: userState.userFid }),
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

  const handleShare = async () => {
    setShowInviteModal(true);
  };

  async function handleInvite(mentions: string[]) {
    if (!challenge) return;
    try {
      // Asegurar que cada mención tenga @ al inicio
      const formattedMentions = mentions.map(mention => 
        mention.startsWith('@') ? mention : `@${mention}`
      );
      
      let text = '';
      if (alreadyJoined || joinStatus === 'joined') {
        // Joined share
        text = `I just joined the challenge: "${challenge.title}" and I'm inviting ${formattedMentions.join(' ')} to join me.`;
      } else {
        // Not joined share
        text = `Check out this challenge: "${challenge.title}"! Join me and let's achieve our goals together! ${formattedMentions.join(' ')}`;
      }
      const url = `${process.env.NEXT_PUBLIC_URL}/di-challenge/${challenge.id}`;
      await sdk.actions.composeCast({
        text: text,
        embeds: [url]
      });
    } catch (error) {
      console.error('Error sharing challenge:', error);
    }
    setShowInviteModal(false);
  }

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
      <div className="flex justify-between items-center w-full max-w-2xl mb-2 px-4">
      <div className="w-full max-w-2xl mx-auto bg-gray-900 border-2 border-gray-700 rounded-xl p-4 shadow-2xl">
        {loading ? (
          <div className="text-gray-400 text-center py-8">Loading challenge...</div>
        ) : error ? (
          <div className="text-red-400 text-center py-8">{error}</div>
        ) : challenge ? (
          <>
            <div className="flex flex-col items-center mb-2">
              {challenge.image_url && (
                <Image
                  src={challenge.image_url}
                  alt={challenge.title || 'Challenge'}
                  width={160}
                  height={160}
                  className="object-cover mb-2"
                  unoptimized
                />
              )}
              <h2 className="text-xl font-bold text-white mb-2">{challenge.title}</h2>
              {challenge.is_official && (
                <span className="px-2 py-0.5 text-xs rounded bg-violet-700 text-white font-semibold mb-2">Official</span>
              )}
              <div className="text-gray-400 text-center mb-2">{challenge.description}</div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-white mb-4 justify-center">
              <span className="bg-gray-800 px-2 py-1 rounded">Activity: {challenge.activity_type}</span>
              {/* <span className="bg-gray-800 px-2 py-1 rounded">Objective: {challenge.objective_type}</span> */}
              <span className="bg-gray-800 px-2 py-1 rounded">Goal: {challenge.goal_amount}</span>
              <span className="bg-gray-800 px-2 py-1 rounded">Duration: {challenge.duration_days} days</span>
              <span className="bg-gray-800 px-2 py-1 rounded">Start: {challenge.start_date ? new Date(challenge.start_date).toLocaleDateString() : '-'}</span>
            </div>
            {/* Share button always visible */}
            <div className="flex justify-center gap-4 mb-2">
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-white font-bold border-2 border-violet-700 transition-colors"
              >
                <ShareIcon className="w-5 h-5" />
                Share
              </button>
              {alreadyJoined || joinStatus === 'joined' ? (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-white font-bold border-2 border-violet-700 transition-colors"
                >
                  <ShareIcon className="w-5 h-5" />
                  Invite friends
                </button>
              ) : (
                <button
                  onClick={handleJoin}
                  disabled={joinStatus === 'joining'}
                  className="px-4 py-2 text-sm font-bold text-white bg-violet-600 border-2 border-violet-700 rounded-md hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 transition-colors"
                >
                  {joinStatus === 'joining' ? 'Joining...' : 'Join'}
                </button>
              )}
            </div>
            {joinStatus === 'error' && (
              <div className="text-red-400 text-center mt-2">{error}</div>
            )}
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
          </>
        ) : null}
      </div>
      </div>
      {showInviteModal && (
        <InviteFriendsModal
          onInvite={handleInvite}
          onClose={() => setShowInviteModal(false)}
          currentFid={Number(userState.userFid)}
        />
      )}
    </div>
  );
} 
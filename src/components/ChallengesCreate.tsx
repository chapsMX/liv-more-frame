"use client";

import { protoMono } from '../styles/fonts';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useUser } from '../context/UserContext';
import { useState, useEffect } from 'react';
import sdk from "@farcaster/frame-sdk";

const ADMIN_FIDS = [20701, 348971, 1020677];

export default function ChallengesCreate() {
  const router = useRouter();
  const { userState } = useUser();
  const isAdmin = ADMIN_FIDS.includes(Number(userState.userFid));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityTypes, setActivityTypes] = useState<Array<{id: number, name: string, description: string}>>([]);
  const [objectiveTypes, setObjectiveTypes] = useState<Array<{id: string, name: string, description: string}>>([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    activity_type_id: '',
    objective_type: '',
    goal_amount: '',
    duration_days: '',
    start_date: '',
    image_url: '',
    is_official: false,
    points_value: '',
    badge_id: '',
    entry_cost: ''
  });
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [createdChallenge, setCreatedChallenge] = useState<{ challenge_id: number } | null>(null);

  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const res = await fetch('/api/challenges');
        if (res.ok) {
          const data = await res.json();
          setActivityTypes(data.activity_types);
          setObjectiveTypes(data.objective_types);
        }
      } catch (err) {
        console.error('Error fetching challenge types:', err);
      }
    };
    fetchTypes();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setForm(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      setForm(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/challenges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          user_fid: userState.userFid,
          activity_type_id: parseInt(form.activity_type_id),
          goal_amount: parseInt(form.goal_amount),
          duration_days: parseInt(form.duration_days),
          points_value: form.is_official ? parseInt(form.points_value) : null,
          badge_id: form.is_official ? parseInt(form.badge_id) : null,
          entry_cost: form.entry_cost === '' ? null : parseFloat(form.entry_cost)
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error creating challenge');
      }

      setCreatedChallenge(data);
      const relevantFollowersRes = await fetch(`/api/neynar/relevant-followers?viewer_fid=${userState.userFid}`);
      const rawResponse = await relevantFollowersRes.clone().text();
      console.log('[InviteFriends] Raw relevant followers response:', rawResponse);
      const relevantFollowersData = await relevantFollowersRes.json();
      console.log('[InviteFriends] relevant followers data:', relevantFollowersData);
      if (relevantFollowersData.success && relevantFollowersData.data && relevantFollowersData.data.top_relevant_followers_hydrated) {
        const followers = relevantFollowersData.data.top_relevant_followers_hydrated.map((f: { user: { fid: number; username: string; display_name: string; pfp_url: string } }) => ({
          user: {
            fid: f.user.fid.toString(),
            username: f.user.username,
            display_name: f.user.display_name,
            pfp_url: f.user.pfp_url
          }
        })).slice(0, 8);
        console.log('[InviteFriends] relevant followers:', followers);
        setFriends(followers);
      } else {
        console.error('[InviteFriends] Failed to fetch relevant followers:', relevantFollowersData.error);
        setFriends([]);
      }
      setShowInviteModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating challenge');
    } finally {
      setIsSubmitting(false);
    }
  };

  async function handleInvite(mentions: string[]) {
    if (!createdChallenge) return;
    try {
      const text = `I just created a new challenge: "${form.title}"! Join me and let's achieve our goals together! 🎯\n\n${mentions.join(' ')}`;
      const url = `${process.env.NEXT_PUBLIC_BASE_URL}/di-challenge/${createdChallenge.challenge_id}`;
      await sdk.actions.composeCast({
        text: text,
        embeds: [url]
      });
    } catch (error) {
      console.error('Error sharing challenge:', error);
    }
    setShowInviteModal(false);
    router.push('/challenges');
  }

  return (
    <div className={`min-h-screen bg-black text-white ${protoMono.className}`}>
      {/* Top menu LivMore */}
      <div className="flex justify-between items-center w-full max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center">
          <Image
            src="/livMore_w.png"
            alt="Liv More"
            width={60}
            height={60}
            priority
          />
        </div>
        {/* Back button */}
        <button
          onClick={() => router.push('/challenges')}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg text-white hover:bg-gray-700 transition-colors border-2 border-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>
      </div>
      {/* Creation form */}
      <div className="flex flex-col items-center justify-center px-2 pb-8">
        <div className="bg-gray-900 border-2 border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl mt-4">
          <h2 className="text-xl font-bold mb-4 text-white">Create Challenge</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-violet-300">Title</label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 text-white shadow-sm focus:border-violet-500 focus:ring-violet-500 border-2 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-violet-300">Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                required
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 text-white shadow-sm focus:border-violet-500 focus:ring-violet-500 border-2 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-violet-300">Activity type</label>
              <select
                name="activity_type_id"
                value={form.activity_type_id}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 text-white shadow-sm focus:border-violet-500 focus:ring-violet-500 border-2 px-3 py-2"
              >
                <option value="">Select an activity</option>
                {activityTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-violet-300">Objective type</label>
              <select
                name="objective_type"
                value={form.objective_type}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 text-white shadow-sm focus:border-violet-500 focus:ring-violet-500 border-2 px-3 py-2"
              >
                <option value="">Select an objective</option>
                {objectiveTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.name} - {type.description}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-violet-300">Goal</label>
              <input
                type="number"
                name="goal_amount"
                value={form.goal_amount}
                onChange={handleChange}
                required
                min="0"
                className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 text-white shadow-sm focus:border-violet-500 focus:ring-violet-500 border-2 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-violet-300">Duration (days)</label>
              <input
                type="number"
                name="duration_days"
                value={form.duration_days}
                onChange={handleChange}
                required
                min="1"
                className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 text-white shadow-sm focus:border-violet-500 focus:ring-violet-500 border-2 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-violet-300">Start date</label>
              <input
                type="datetime-local"
                name="start_date"
                value={form.start_date}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 text-white shadow-sm focus:border-violet-500 focus:ring-violet-500 border-2 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-violet-300">Image URL</label>
              <input
                type="url"
                name="image_url"
                value={form.image_url}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 text-white shadow-sm focus:border-violet-500 focus:ring-violet-500 border-2 px-3 py-2"
              />
            </div>
            {isAdmin && (
              <>
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    name="is_official"
                    checked={form.is_official}
                    onChange={handleChange}
                    className="h-4 w-4 text-violet-600 focus:ring-violet-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-violet-200">Official challenge</label>
                </div>
                {form.is_official && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-violet-300">Points</label>
                      <input
                        type="number"
                        name="points_value"
                        value={form.points_value}
                        onChange={handleChange}
                        required
                        min="0"
                        className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 text-white shadow-sm focus:border-violet-500 focus:ring-violet-500 border-2 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-violet-300">Badge ID</label>
                      <input
                        type="number"
                        name="badge_id"
                        value={form.badge_id}
                        onChange={handleChange}
                        required
                        min="0"
                        className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 text-white shadow-sm focus:border-violet-500 focus:ring-violet-500 border-2 px-3 py-2"
                      />
                    </div>
                  </>
                )}
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-violet-300">Entry cost (optional)</label>
              <input
                type="number"
                name="entry_cost"
                value={form.entry_cost}
                onChange={handleChange}
                min="0"
                placeholder="0"
                className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 text-white shadow-sm focus:border-violet-500 focus:ring-violet-500 border-2 px-3 py-2"
              />
            </div>
            {error && (
              <div className="text-red-400 text-sm text-center">{error}</div>
            )}
            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={() => router.push('/challenges')}
                className="px-4 py-2 text-sm font-medium text-violet-300 bg-gray-800 border border-violet-700 rounded-md hover:bg-gray-700 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-bold text-white bg-violet-600 border-2 border-violet-700 rounded-md hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 transition-colors"
              >
                {isSubmitting ? 'Creating...' : 'Create challenge'}
              </button>
            </div>
          </form>
        </div>
      </div>
      {showInviteModal && (
        <InviteFriendsModal
          friends={friends}
          onInvite={handleInvite}
          onClose={() => {
            setShowInviteModal(false);
            router.push('/challenges');
          }}
          currentFid={Number(userState.userFid)}
        />
      )}
    </div>
  );
}

type Friend = { user: { fid: string; username: string; display_name?: string; pfp_url?: string } };
type InviteFriendsModalProps = {
  friends: Friend[];
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
        // Extract unique users from parent_author and mentioned_profiles
        const seen = new Set<number>();
        const userList: { fid: number; username?: string; pfp_url?: string }[] = [];
        type NeynarProfile = { fid: number; username?: string; pfp_url?: string };
        type NeynarCast = {
          parent_author?: { fid?: number };
          mentioned_profiles?: NeynarProfile[];
        };
        (data.casts || []).forEach((cast: NeynarCast) => {
          // 1. Add parent_author (user you replied to)
          if (cast.parent_author && cast.parent_author.fid && cast.parent_author.fid !== currentFid && !seen.has(cast.parent_author.fid)) {
            seen.add(cast.parent_author.fid);
            // Try to get username/pfp_url from mentioned_profiles if available
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
          // 2. Add mentioned_profiles
          (cast.mentioned_profiles || []).forEach((profile: NeynarProfile) => {
            if (profile.fid !== currentFid && !seen.has(profile.fid)) {
              seen.add(profile.fid);
              userList.push({ fid: profile.fid, username: profile.username, pfp_url: profile.pfp_url });
            }
          });
        });
        const limitedUsers = userList.slice(0, 10);
        // Find FIDs missing username or pfp_url
        const missingFids = limitedUsers.filter(u => !u.username || !u.pfp_url).map(u => u.fid);
        if (missingFids.length > 0) {
          // Fetch missing profiles in batch
          const resp = await fetch(`/api/neynar/users?fids=${missingFids.join(',')}`);
          const profileData = await resp.json();
          if (profileData.users && Array.isArray(profileData.users)) {
            // Map FID to profile
            const profileMap = new Map<number, { username: string; pfp_url: string }>();
            profileData.users.forEach((user: NeynarProfile) => {
              profileMap.set(user.fid, { username: user.username || '', pfp_url: user.pfp_url || '' });
            });
            // Merge info into userList
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
        <h2 className="text-xl font-bold mb-4 text-white">Invite friends to your challenge</h2>
        <div className="flex flex-col gap-3 mb-4">
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
                    className="rounded-full border border-gray-700" 
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

"use client";

import { protoMono } from '../styles/fonts';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { Badge, CreateBadgeRequest } from '../types/badge';
import { useUser } from '../context/UserContext';
import sdk from "@farcaster/frame-sdk";

const ADMIN_FIDS = [20701, 348971, 1020677];

export default function Badges() {
  const router = useRouter();
  const { userState } = useUser();
  const isAdmin = userState.userFid ? ADMIN_FIDS.includes(userState.userFid) : false;
  const [badges, setBadges] = useState<Badge[]>([]);
  const [myBadges, setMyBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [pfpUrl, setPfpUrl] = useState<string>();
  const [newBadge, setNewBadge] = useState<CreateBadgeRequest>({
    name: '',
    badge_type: '',
    total_supply: 100,
    category: '',
    image_url: '',
    description: '',
    metadata: {
      name: '',
      description: '',
      badge_type: '',
      category: '',
      image: ''
    }
  });

  const fetchBadges = async () => {
    try {
      const response = await fetch('/api/badges');
      if (!response.ok) {
        throw new Error('Failed to fetch badges');
      }
      const data = await response.json();
      setBadges(data.badges);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMyBadges = async () => {
    try {
      const response = await fetch(`/api/badges/my-badges?userFid=${userState.userFid}`);
      if (!response.ok) {
        throw new Error('Failed to fetch my badges');
      }
      const data = await response.json();
      setMyBadges(data.badges);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  useEffect(() => {
    fetchBadges();
    if (userState.userFid) {
      fetchMyBadges();
    }
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

  const handleCreateBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('Sending badge data:', newBadge);
      const response = await fetch('/api/badges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-fid': userState.userFid?.toString() || '',
        },
        body: JSON.stringify(newBadge),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        if (errorData.details) {
          type ErrorDetail = { path: string[]; message: string };
          const errorDetails = (errorData.details as ErrorDetail[]).map((err) => `${err.path.join('.')}: ${err.message}`).join('\n');
          throw new Error(`Validation failed:\n${errorDetails}`);
        }
        throw new Error(errorData.error || 'Failed to create badge');
      }

      await fetchBadges();
      setShowCreateForm(false);
      setNewBadge({
        name: '',
        badge_type: '',
        total_supply: 100,
        category: '',
        image_url: '',
        description: '',
        metadata: {
          name: '',
          description: '',
          badge_type: '',
          category: '',
          image: ''
        }
      });
    } catch (err) {
      console.error('Full error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'image_url') {
      setNewBadge(prev => ({
        ...prev,
        image_url: value,
        metadata: {
          ...prev.metadata,
          image: value
        }
      }));
    } else if (name === 'total_supply') {
      setNewBadge(prev => ({
        ...prev,
        total_supply: parseInt(value) || 0
      }));
    } else if (name.startsWith('metadata.')) {
      const metadataField = name.split('.')[1];
      setNewBadge(prev => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          [metadataField]: value
        }
      }));
    } else {
      setNewBadge(prev => ({
        ...prev,
        [name]: value,
        metadata: {
          ...prev.metadata,
          [name]: value
        }
      }));
    }
  };

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

        {error && (
          <div className="text-red-400 text-center my-2">{error}</div>
        )}

        {/* Main Content */}
        <div className="flex flex-col items-center justify-center space-y-6 p-2">
          <h1 className="text-2xl font-bold text-white mb-2">Available Badges</h1>

          {/* Carrousel de Available Badges */}
          <div className="w-full max-w-2xl overflow-x-auto pb-2">
            <div className="flex flex-row gap-4 snap-x snap-mandatory overflow-x-auto px-1">
              {isLoading ? (
                <div className="text-gray-400 text-center py-8">Loading badges...</div>
              ) : badges.length === 0 ? (
                <div className="text-gray-400 text-center py-8">No badges available yet.</div>
              ) : (
                badges.map((badge) => (
                  <div
                    key={badge.id}
                    className="min-w-[160px] max-w-xs bg-gray-900 border-2 border-gray-700 rounded-xl p-2 flex flex-col items-center shadow-lg cursor-pointer hover:border-violet-700 transition-colors snap-center"
                    onClick={() => router.push(`/badges/${badge.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter') router.push(`/badges/${badge.id}`); }}
                  >
                    {badge.image_url && (
                      <div className="flex-shrink-0 mb-2">
                        <Image
                          src={badge.image_url}
                          alt={badge.name}
                          width={80}
                          height={80}
                          className="rounded-lg border border-gray-700 object-cover"
                          unoptimized
                        />
                      </div>
                    )}
                    <div className="flex-1 w-full flex flex-col items-center">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-white py-0 text-center m-0">{badge.name}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 text-xs text-gray-300 mb-0 justify-left w-full">
                        <span className="px-1 py-0">Type: {badge.badge_type}</span>
                        <span className="px-1 py-0">Category: {badge.category}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* My Badges */}
          <h2 className="text-xl font-bold text-white mt-0 mb-2">My Badges</h2>
          <div className="w-full max-w-2xl flex flex-col gap-2">
            {isLoading ? (
              <div className="text-gray-400 text-center py-4">Loading your badges...</div>
            ) : myBadges.length === 0 ? (
              <div className="text-gray-400 text-center py-4">You haven&apos;t earned any badges yet.</div>
            ) : (
              myBadges.map((badge) => (
                <div
                  key={badge.id}
                  className="flex items-center justify-between bg-gray-900 border-2 border-gray-700 rounded-xl p-2 shadow cursor-pointer hover:border-violet-700 transition-colors"
                  onClick={() => router.push(`/badges/${badge.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter') router.push(`/badges/${badge.id}`); }}
                >
                  <div className="flex items-center gap-3">
                    {badge.image_url && (
                      <Image
                        src={badge.image_url}
                        alt={badge.name}
                        width={40}
                        height={40}
                        className="rounded-lg border border-gray-700"
                        unoptimized
                      />
                    )}
                    <span className="text-base font-semibold text-white">{badge.name}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {badge.earned_at ? `Earned: ${new Date(badge.earned_at).toLocaleDateString()}` : 'Not earned yet'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Botón para crear badge */}
        {isAdmin && (
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 px-6 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-white font-bold border-2 border-violet-700 transition-colors mb-4"
            >
              {showCreateForm ? 'Cancel' : 'Create Badge'}
            </button>
          </div>
        )}

        {/* Formulario de creación */}
        {showCreateForm && (
          <form onSubmit={handleCreateBadge} className="w-full max-w-2xl mx-auto bg-gray-900 border-2 border-gray-700 rounded-xl p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Name</label>
                <input
                  type="text"
                  name="name"
                  value={newBadge.name}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Badge Type</label>
                <input
                  type="text"
                  name="badge_type"
                  value={newBadge.badge_type}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Category</label>
                <input
                  type="text"
                  name="category"
                  value={newBadge.category}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Total Supply</label>
                <input
                  type="number"
                  name="total_supply"
                  value={newBadge.total_supply}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-300">Image URL</label>
                <input
                  type="url"
                  name="image_url"
                  value={newBadge.image_url}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white"
                  required
                  placeholder="https://tan-leading-pelican-169.mypinata.cloud/ipfs/..."
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-300">Description</label>
                <textarea
                  name="description"
                  value={newBadge.description}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white"
                  rows={3}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-violet-600 rounded-lg text-white hover:bg-violet-700 transition-colors"
              >
                Create Badge
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

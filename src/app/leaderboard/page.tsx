"use client";

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { protoMono } from '../../styles/fonts';
import { useUser } from '../../context/UserContext';
import { useRouter } from 'next/navigation';

// Types
interface PersonalRecord {
  max_steps: number;
  max_calories: number;
  max_steps_date: string | null;
  max_calories_date: string | null;
  daily_steps: number;
  daily_calories: number;
  weekly_steps: number;
  weekly_calories: number;
  monthly_steps: number;
  monthly_calories: number;
}

interface LeaderboardEntry {
  rank: number;
  user_fid: number;
  username: string;
  display_name: string;
  total?: number;
  monthly_total?: number;
  active_days?: number;
  active_days_in_month?: number;
  daily_average?: number;
  metric: string;
}

interface UserProfile {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  follower_count: number;
  following_count: number;
}

interface AvailableMonth {
  year: number;
  month: number;
  month_name: string;
  display_name: string;
  user_count: number;
  activity_count: number;
}

export default function LeaderboardPage() {
  const { userState } = useUser();
  const router = useRouter();

  // States
  const [pfpUrl, setPfpUrl] = useState<string>();
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord | null>(null);
  const [topLeaderboard, setTopLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [monthlyLeaderboard, setMonthlyLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userProfiles, setUserProfiles] = useState<Map<number, UserProfile>>(new Map());
  const [availableMonths, setAvailableMonths] = useState<AvailableMonth[]>([]);
  
  // UI States
  const [activeTab, setActiveTab] = useState<'top' | 'monthly'>('top');
  const [selectedMetric, setSelectedMetric] = useState<'steps' | 'calories'>('steps');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Fetch personal records
  const fetchPersonalRecords = useCallback(async () => {
    if (!userState.userFid) return;

    try {
      const response = await fetch(`/api/leaderboard/personal-records?user_fid=${userState.userFid}`);
      const data = await response.json();
      
      if (response.ok) {
        setPersonalRecords(data);
      } else {
        console.error('Error fetching personal records:', data.error);
      }
    } catch (error) {
      console.error('Error fetching personal records:', error);
    }
  }, [userState.userFid]);

  // Fetch user profiles from Neynar
  const fetchUserProfiles = useCallback(async (userFids: number[]) => {
    if (userFids.length === 0) return;

    try {
      const fidsString = userFids.join(',');
      const response = await fetch(`/api/neynar?fids=${fidsString}`);
      const data = await response.json();
      
      if (data.success && data.users) {
        const profileMap = new Map<number, UserProfile>();
        data.users.forEach((user: Record<string, unknown>) => {
          profileMap.set(user.fid as number, {
            fid: user.fid as number,
            username: user.username as string,
            display_name: user.display_name as string,
            pfp_url: user.pfp_url as string,
            follower_count: 0, // No necesitamos este campo
            following_count: 0  // No necesitamos este campo
          });
        });
        setUserProfiles(prev => new Map([...prev, ...profileMap]));
      } else {
        console.error('Error fetching user profiles from Neynar:', data.error);
      }
    } catch (error) {
      console.error('Error fetching user profiles:', error);
    }
  }, []);

  // Fetch top leaderboard
  const fetchTopLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const response = await fetch(`/api/leaderboard/top?metric=${selectedMetric}&limit=1000`);
      const data = await response.json();
      
      if (response.ok) {
        setTopLeaderboard(data.leaderboard);
        
        // Fetch profiles for users in leaderboard - convert to numbers
        const userFids = data.leaderboard.map((entry: LeaderboardEntry) => Number(entry.user_fid));
        await fetchUserProfiles(userFids);
      } else {
        console.error('Error fetching top leaderboard:', data.error);
      }
    } catch (error) {
      console.error('Error fetching top leaderboard:', error);
    } finally {
      setLeaderboardLoading(false);
    }
  }, [selectedMetric, fetchUserProfiles]);

  // Fetch monthly leaderboard
  const fetchMonthlyLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const response = await fetch(`/api/leaderboard/monthly?metric=${selectedMetric}&year=${selectedYear}&month=${selectedMonth}&limit=1000`);
      const data = await response.json();
      
      if (response.ok) {
        setMonthlyLeaderboard(data.leaderboard);
        
        // Fetch profiles for users in leaderboard - convert to numbers
        const userFids = data.leaderboard.map((entry: LeaderboardEntry) => Number(entry.user_fid));
        await fetchUserProfiles(userFids);
      } else {
        console.error('Error fetching monthly leaderboard:', data.error);
      }
    } catch (error) {
      console.error('Error fetching monthly leaderboard:', error);
    } finally {
      setLeaderboardLoading(false);
    }
  }, [selectedMetric, selectedYear, selectedMonth, fetchUserProfiles]);

  // Fetch available months
  const fetchAvailableMonths = useCallback(async () => {
    try {
      const response = await fetch('/api/leaderboard/available-months');
      const data = await response.json();
      
      if (response.ok) {
        setAvailableMonths(data.available_months);
        
        // Set default to most recent month if available
        if (data.available_months.length > 0) {
          const latest = data.available_months[0];
          setSelectedYear(latest.year);
          setSelectedMonth(latest.month);
        }
      } else {
        console.error('Error fetching available months:', data.error);
      }
    } catch (error) {
      console.error('Error fetching available months:', error);
    }
  }, []);

  // Load user profile
  useEffect(() => {
    const loadUserProfile = async () => {
      const sdk = await import("@farcaster/frame-sdk");
      const context = await sdk.sdk.context;
      if (context.user?.pfpUrl) {
        setPfpUrl(context.user.pfpUrl);
      }
    };

    loadUserProfile();
  }, []);

  // Initial data fetch
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      
      // Check user permissions
      if (!userState.isWhitelisted || !userState.acceptedTos || !userState.acceptedPrivacyPolicy || !userState.canUse) {
        router.push('/');
        return;
      }

      await Promise.all([
        fetchPersonalRecords(),
        fetchAvailableMonths()
      ]);
      
      setLoading(false);
    };

    initializeData();
  }, [userState, router, fetchPersonalRecords, fetchAvailableMonths]);

  // Fetch leaderboard when filters change
  useEffect(() => {
    if (!loading) {
      if (activeTab === 'top') {
        fetchTopLeaderboard();
      } else {
        fetchMonthlyLeaderboard();
      }
    }
  }, [activeTab, selectedMetric, selectedYear, selectedMonth, loading, fetchTopLeaderboard, fetchMonthlyLeaderboard]);

  // Format number with commas
  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };



  // Render leaderboard table
  const renderLeaderboardTable = (leaderboard: LeaderboardEntry[]) => {
    if (leaderboard.length === 0) {
      return (
        <div className="text-center py-8">
          <p className={`text-gray-400 ${protoMono.className}`}>
            No data available for the selected period
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        {/* Table Rows */}
        <div className="space-y-0.5">
          {leaderboard.map((entry) => {
            const profile = userProfiles.get(Number(entry.user_fid));
            const isCurrentUser = Number(entry.user_fid) === userState.userFid;
            const total = entry.total || entry.monthly_total || 0;
            
            return (
              <div
                key={`${entry.user_fid}-${entry.rank}`}
                className={`grid grid-cols-[auto_auto_1fr_auto] gap-3 p-2 transition-all duration-300 border-l-2 ${
                  isCurrentUser
                    ? 'border-l-violet-500 bg-violet-900/20'
                    : 'border-l-transparent hover:bg-gray-800/30'
                }`}
              >
                {/* Posición */}
                <div className="flex items-center">
                  <span className={`text-sm font-bold ${protoMono.className} ${
                    isCurrentUser ? 'text-violet-400' : 'text-white'
                  }`}>
                    #{entry.rank}
                  </span>
                </div>

                {/* PFP */}
                <div className="flex items-center">
                  {profile?.pfp_url ? (
                    <img
                      src={profile.pfp_url}
                      alt={profile.display_name || profile.username || 'User'}
                      width="32"
                      height="32"
                      className="rounded-full border border-gray-600 object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.setAttribute('style', 'display: flex;');
                      }}
                    />
                  ) : null}
                  <div 
                    className="w-8 h-8 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center"
                    style={{ display: profile?.pfp_url ? 'none' : 'flex' }}
                  >
                    <span className={`text-gray-400 text-xs ${protoMono.className}`}>
                      {(profile?.username || entry.username)?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                </div>

                {/* Nombre */}
                <div className="flex items-center">
                  <div className="flex flex-col">
                    <span className={`text-sm font-medium ${protoMono.className} ${
                      isCurrentUser ? 'text-violet-400' : 'text-white'
                    } truncate`}>
                      {profile?.display_name || entry.display_name || profile?.username || entry.username || 'Usuario'}
                    </span>
                    {profile?.display_name && profile?.username && (
                      <span className={`text-xs text-gray-400 ${protoMono.className} truncate`}>
                        @{profile.username}
                      </span>
                    )}
                  </div>
                </div>

                {/* Métrica */}
                <div className="flex items-center justify-end">
                  <span className={`text-sm font-bold ${protoMono.className} ${
                    isCurrentUser ? 'text-violet-400' : 'text-white'
                  }`}>
                    {formatNumber(total)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
        <div className="text-center">
          <p className={`text-xl ${protoMono.className}`}>Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-2">
        {/* Header */}
        <div className="flex justify-between items-center w-full max-w-2xl mb-2">
          <div className="flex items-center">
            <Image
              src="/livMore_w.png"
              alt="Liv More"
              width={60}
              height={60}
              priority
            />
          </div>
          
          {/* User Profile with Back Arrow */}
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

        {/* Page Title */}
        <div className="flex items-center justify-center mb-4 w-full mx-auto">
          <h1 className={`text-2xl font-bold text-white ${protoMono.className}`}>
            Leaderboard
          </h1>
        </div>

        <div className="w-full mx-auto">{/* Wrapper for content */}

        {/* Personal Records Section */}
        {personalRecords && (
          <div className="mb-4 p-4 bg-gray-900 rounded-xl border-2 border-gray-700">
            <h2 className={`text-xl font-bold text-white mb-4 ${protoMono.className}`}>
              Your Personal Records
            </h2>
            <div className="space-y-3">
              <div className={`text-white ${protoMono.className}`}>
                <div className="font-bold mb-1">Steps:</div>
                <div className="text-sm text-gray-300">
                  Day: {formatNumber(personalRecords.daily_steps || 0)} steps
                </div>
                <div className="text-sm text-gray-300">
                  Week: {formatNumber(personalRecords.weekly_steps || 0)} steps
                </div>
                <div className="text-sm text-gray-300">
                  Month: {formatNumber(personalRecords.monthly_steps || 0)} steps
                </div>
              </div>
              
              <div className={`text-white ${protoMono.className}`}>
                <div className="font-bold mb-1">Calories:</div>
                <div className="text-sm text-gray-300">
                  Day: {formatNumber(personalRecords.daily_calories || 0)} calories
                </div>
                <div className="text-sm text-gray-300">
                  Week: {formatNumber(personalRecords.weekly_calories || 0)} calories
                </div>
                <div className="text-sm text-gray-300">
                  Month: {formatNumber(personalRecords.monthly_calories || 0)} calories
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard Tabs */}
        <div className="mb-3">
          <div className="flex space-x-1 bg-gray-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('top')}
              className={`flex-1 py-2 px-4 rounded-md transition-all duration-200 ${protoMono.className} ${
                activeTab === 'top'
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🏆 Single Day Records
            </button>
            <button
              onClick={() => setActiveTab('monthly')}
              className={`flex-1 py-2 px-4 rounded-md transition-all duration-200 ${protoMono.className} ${
                activeTab === 'monthly'
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              📅 Monthly Leaderboard
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-3 space-y-3">
          {/* Metric Filter */}
          <div className="flex space-x-1 bg-gray-800 p-1 rounded-lg">
            <button
              onClick={() => setSelectedMetric('steps')}
              className={`flex-1 py-2 px-4 rounded-md transition-all duration-200 ${protoMono.className} ${
                selectedMetric === 'steps'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              👣 Steps
            </button>
            <button
              onClick={() => setSelectedMetric('calories')}
              className={`flex-1 py-2 px-4 rounded-md transition-all duration-200 ${protoMono.className} ${
                selectedMetric === 'calories'
                  ? 'bg-orange-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🔥 Calories
            </button>
          </div>

          {/* Month Filter (only for monthly tab) */}
          {activeTab === 'monthly' && (
            <div className="flex space-x-4">
              <select
                value={`${selectedYear}-${selectedMonth}`}
                onChange={(e) => {
                  const [year, month] = e.target.value.split('-');
                  setSelectedYear(parseInt(year));
                  setSelectedMonth(parseInt(month));
                }}
                className={`flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white ${protoMono.className} focus:border-violet-500 focus:outline-none`}
              >
                {availableMonths.map((month) => (
                  <option key={`${month.year}-${month.month}`} value={`${month.year}-${month.month}`}>
                    {month.display_name} ({month.user_count} users)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="bg-gray-900 rounded-xl border-2 border-gray-700 p-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className={`text-lg font-bold text-white ${protoMono.className}`}>
              {activeTab === 'top' 
                ? `Most ${selectedMetric === 'steps' ? 'Steps' : 'Calories'} in a Single Day (All Time)` 
                : `${selectedMetric === 'steps' ? 'Steps' : 'Calories'} - ${availableMonths.find(m => m.year === selectedYear && m.month === selectedMonth)?.display_name || 'Current Month'}`
              }
            </h2>
            {leaderboardLoading && (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-500"></div>
            )}
          </div>

          {leaderboardLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500 mx-auto"></div>
              <p className={`text-gray-400 mt-4 ${protoMono.className}`}>Loading leaderboard...</p>
            </div>
          ) : (
            renderLeaderboardTable(activeTab === 'top' ? topLeaderboard : monthlyLeaderboard)
          )}
        </div>
        </div>{/* Close wrapper div */}
      </div>
    </div>
  );
}

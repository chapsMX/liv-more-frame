"use client";

import { protoMono } from '../styles/fonts';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useUser } from '../context/UserContext';
import { useState, useEffect } from 'react';
import { sdk } from "@farcaster/miniapp-sdk";

// Define the Attestation type based on the user_attestations table schema
interface Attestation {
  id: number;
  name: string;
  display_name: string;
  wallet: string;
  metric_type: string;
  goal_value: number;
  actual_value: number;
  timestamp: string; // ISO string
  challenge_id: string; // Assuming it can be null or empty string
  title: string;
  description: string;
  image_url: string;
  attestation_uid: string;
  created_at: string; // ISO string
}

export default function Attestations() {
  const router = useRouter();
  const { userState } = useUser();
  const [pfpUrl, setPfpUrl] = useState<string>();
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetricType, setSelectedMetricType] = useState<string>('all');

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
    const fetchAttestations = async () => {
      if (!userState.userFid) {
        setError('User FID not available.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        let url = `/api/attestations/get-attestations?userFid=${userState.userFid}`;
        if (selectedMetricType !== 'all') {
          url += `&metricType=${selectedMetricType}`;
        }
        console.log('Fetching attestations from:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        console.log('Response data:', data);

        if (response.ok) {
          if (Array.isArray(data.attestations)) {
            setAttestations(data.attestations);
          } else {
            console.error('Unexpected data format:', data);
            setError('Invalid data format received from server');
          }
        } else {
          const errorMessage = data.error || data.details || 'Failed to fetch attestations';
          console.error('Server error:', errorMessage);
          setError(errorMessage);
        }
      } catch (err) {
        console.error('Error fetching attestations:', err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttestations();
  }, [userState.userFid, selectedMetricType]);

  const handleAttestationClick = (attestation: Attestation) => {
    // Navegar a la página de detalle de la atestación
    router.push(`/attestations/${attestation.id}`);
  };

  const uniqueMetricTypes = Array.from(new Set(attestations.map(att => att.metric_type)));

  return (
    <div className={`min-h-screen bg-black text-white ${protoMono.className}`}>
      <div className="container mx-auto px-4 py-2">
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
        <div className="flex flex-col items-center justify-center space-y-6 p-2">
          <h1 className={`text-2xl font-bold text-white mb-2 ${protoMono.className}`}>
            Your Attestations
          </h1>

          <div className="w-full max-w-4xl bg-gray-900 border-2 border-gray-700 rounded-xl p-2">
            <div className="mb-4">
              <label htmlFor="metric-type-filter" className="block text-gray-400 text-sm font-bold mb-2">
                Filter by Metric Type:
              </label>
              <select
                id="metric-type-filter"
                className="block w-full bg-gray-800 border border-gray-600 text-white text-2xs py-2 px-3 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedMetricType}
                onChange={(e) => setSelectedMetricType(e.target.value)}
              >
                <option value="all">All</option>
                {uniqueMetricTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {isLoading && <p className="text-gray-400 text-center">Loading attestations...</p>}
            {error && <p className="text-red-500 text-center">Error: {error}</p>}
            {!isLoading && !error && attestations.length === 0 && (
              <p className="text-gray-400 text-center">No attestations found.</p>
            )}

            {!isLoading && !error && attestations.length > 0 && (
              <div className="space-y-4">
                {attestations.map((attestation) => (
                  <div
                    key={attestation.id}
                    className="bg-gray-800 border border-gray-700 rounded-lg p-2 cursor-pointer hover:border-blue-500 transition-colors"
                    onClick={() => handleAttestationClick(attestation)}
                  >
                    <p className="text-white text-2xs">Metric: {attestation.metric_type}</p>
                    <p className="text-gray-400 text-xs">Goal: {attestation.goal_value}, Achieved: {attestation.actual_value}</p>
                    <p className="text-gray-400 text-xs">Attested on: {new Date(attestation.created_at).toLocaleDateString()}</p>                 
 {/*                <p className="text-gray-400 text-sm">EAS Scanner: {attestation.attestation_uid}</p>
                     {attestation.image_url && (
                        <Image
                            src={attestation.image_url}
                            alt={attestation.title || attestation.name}
                            width={50}
                            height={50}
                            className="mt-2 rounded-md"
                            unoptimized
                        />
                    )} */}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
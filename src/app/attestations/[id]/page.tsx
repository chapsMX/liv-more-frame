'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { protoMono } from '@/styles/fonts';
import { useUser } from '@/context/UserContext';
import { sdk } from "@farcaster/miniapp-sdk";

interface AttestationDetail {
  id: number;
  name: string;
  display_name: string;
  wallet: string;
  metric_type: string;
  goal_value: number;
  actual_value: number;
  timestamp: string;
  challenge_id: string;
  title: string;
  description: string;
  image_url: string;
  attestation_uid: string;
  created_at: string;
  username: string;
}

export default function AttestationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;
  const { userState } = useUser();
  const [pfpUrl, setPfpUrl] = useState<string>();
  const [attestation, setAttestation] = useState<AttestationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    const fetchAttestationDetail = async () => {
      try {
        const response = await fetch(`/api/attestations/${id}`);
        const data = await response.json();

        if (response.ok) {
          setAttestation(data.attestation);
        } else {
          setError(data.error || 'Failed to fetch attestation details');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) fetchAttestationDetail();
  }, [id]);

  if (isLoading) {
    return (
      <div className={`min-h-screen bg-black text-white ${protoMono.className}`}>
        <div className="container mx-auto px-4 py-8">
          <p className="text-center">Loading attestation details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen bg-black text-white ${protoMono.className}`}>
        <div className="container mx-auto px-4 py-8">
          <p className="text-center text-red-500">Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!attestation) {
    return (
      <div className={`min-h-screen bg-black text-white ${protoMono.className}`}>
        <div className="container mx-auto px-4 py-8">
          <p className="text-center">Attestation not found</p>
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
                onClick={() => router.push('/attestations')}
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
        <div className="flex flex-col items-center justify-center space-y-2 p-2">
          <div className="w-full max-w-4xl bg-gray-900 border-2 border-gray-700 rounded-xl p-2">
            <div className="flex items-center gap-4 mb-0">
              <div>
                <h1 className="text-xl font-bold">{attestation.title || attestation.name}</h1>
                <p className="text-gray-400">To: {attestation.username}</p>
                <p className="text-gray-400">From: Liv More</p>
              </div>
            </div>

            {attestation.image_url && (
              <div className="mb-2">
                <Image
                  src={attestation.image_url}
                  alt={attestation.title || attestation.name}
                  width={250}
                  height={250}
                  className="rounded-lg mx-auto"
                  unoptimized
                />
              </div>
            )}

            <div className="space-y-4">
              <div className="bg-gray-800 p-2 rounded-lg">
                <p className="text-md font-semibold mb-0">Achievement Details:</p>
                <p className="text-sm text-gray-400">Metric Type: {attestation.metric_type}</p>
                <p className="text-sm text-gray-400">Goal: {attestation.goal_value}</p>
                <p className="text-sm text-gray-400">Achieved: {attestation.actual_value}</p>
                <p className="text-sm text-gray-400">Date: {new Date(attestation.created_at).toLocaleDateString()}</p>
              </div>

              {attestation.description && (
                <div className="bg-gray-800 p-4 rounded-lg">
                  <p className="text-md font-semibold mb-0">Description:</p>
                  <p className="text-sm text-gray-400">{attestation.description}</p>
                </div>
              )}

              <div className="bg-gray-800 p-4 rounded-lg">
              <p className="text-md font-semibold mb-2">Social:</p>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">
                  <a
                    href={`https://base.easscan.org/attestation/view/${attestation.attestation_uid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    View on EAS
                  </a>
                </p>
                <button
                  onClick={async () => {
                    try {
                      const shareText = `Check this attestation on @base by @livmore\n\n` +
                        `Obtained: ${new Date(attestation.created_at).toLocaleDateString()}\n` +
                        `Daily Goal: ${attestation.goal_value} ${attestation.metric_type}\n` +
                        `Achieved: ${attestation.actual_value} ${attestation.metric_type}\n 🧬 🧬`
                      
                      const easUrl = `https://base.easscan.org/attestation/view/${attestation.attestation_uid}`;
                      
                      await sdk.actions.composeCast({
                        text: shareText,
                        embeds: [easUrl]
                      });
                    } catch (error) {
                      console.error('Error sharing attestation:', error);
                    }
                  }}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium"
                >
                  Share to Farcaster
                </button>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
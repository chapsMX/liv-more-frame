"use client";

import { protoMono } from '../styles/fonts';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function Attestations() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center w-full max-w-2xl mb-8">
          <div className="flex items-center">
            <Image
              src="/livMore_w.png"
              alt="Liv More"
              width={60}
              height={60}
              priority
            />
          </div>
          
          {/* Back Button */}
          <button 
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg text-white hover:bg-gray-700 transition-colors border-2 border-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>
        </div>

        {/* Main Content */}
        <div className="flex flex-col items-center justify-center space-y-6 p-2">
          <h1 className={`text-2xl font-bold text-white mb-0 ${protoMono.className}`}>
            Attestations
          </h1>

          {/* Placeholder for future content */}
          <div className="w-full max-w-4xl bg-gray-900 border-2 border-gray-700 rounded-xl p-6">
            <p className="text-gray-400 text-center">
              Coming soon...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

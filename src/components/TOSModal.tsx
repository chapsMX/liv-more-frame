"use client";

import { useState } from 'react';
import Image from 'next/image';
import { protoMono } from '../styles/fonts';
import { useUser } from '../context/UserContext';

interface TOSModalProps {
  username?: string;
}

export function TOSModal({ username }: TOSModalProps) {
  const { updateUserLegalStatus, isLoading } = useUser();
  const [accepted, setAccepted] = useState(false);

  const handleAccept = async () => {
    if (!accepted) return;
    await updateUserLegalStatus(true, true);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-20">
      <div className="bg-gray-900 border-2 border-gray-700 rounded-xl p-2 max-w-2xl w-full mx-4">
        <div className="flex flex-col items-center gap-2">
          <div className="w-30 h-30 relative">
            <Image
              src="/livMore_w.png"
              alt="Liv More"
              fill
              className="object-contain"
              priority
            />
          </div>

          <div className={`text-center ${protoMono.className} space-y-2 mb-2`}>
            <p className="text-gray-300 text-left text-md leading-relaxed">
            {username ? `${username}` : ''}, to ensure a safe and transparent experience for all users, Liv More requires you to accept our Terms of Service and Privacy Policy. These documents explain how we handle your data, how the app works, and your rights as a user.
            </p>
            <br />
            <p className="text-gray-300 text-left text-md">
              By accepting them, you help us keep Liv More secure, respectful, and aligned with legal standards.
            </p>
            <br />
            <div className="flex items-start gap-3 text-left">
              <input
                type="checkbox"
                id="accept-tos"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="accept-tos" className="text-sm text-gray-300">
                I agree to the{' '}
                <a
                  href="https://livmore.life/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  Terms of Service
                </a>
                {' '}and{' '}
                <a
                  href="https://livmore.life/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  Privacy Policy
                </a>
                . I understand this is a beta.
              </label>
            </div>

            <button
              onClick={handleAccept}
              disabled={!accepted || isLoading}
              className={`w-full py-3 px-6 rounded-lg text-white font-semibold transition-colors ${
                accepted && !isLoading
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-gray-700 cursor-not-allowed'
              }`}
            >
              {isLoading ? 'Processing...' : 'Accept and Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 
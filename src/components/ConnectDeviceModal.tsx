"use client";

import { protoMono } from '../styles/fonts';

interface ConnectDeviceModalProps {
  onClose: () => void;
  onConnect: (provider: string) => void;
}

export default function ConnectDeviceModal({ onClose, onConnect }: ConnectDeviceModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-[#1C1F2A] p-8 rounded-3xl w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className={`text-xl font-bold text-white text-center w-full ${protoMono.className}`}>Connect your wearable!</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors absolute right-4 top-4"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-8">
          <p className={`text-gray-300 ${protoMono.className}`}>
            To continue, you need to connect your wearable device. This will allow us to track your physical activities (steps, calories, and sleep hours).
          </p>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => onConnect('google')}
              className={`p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-center border-2 border-orange-500 ${protoMono.className}`}
            >
              <span className="text-white">Google Fit</span>
            </button>
            <button
              onClick={() => onConnect('oura')}
              className={`p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-center border-2 border-orange-500 ${protoMono.className}`}
            >
              <span className="text-white">Oura</span>
            </button>
            <button
              onClick={() => onConnect('whoop')}
              className={`p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-center border-2 border-orange-500 ${protoMono.className}`}
            >
              <span className="text-white">Whoop</span>
            </button>
            <button
              onClick={() => onConnect('garmin')}
              className={`p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-center border-2 border-orange-500 ${protoMono.className}`}
            >
              <span className="text-white">Garmin</span>
            </button>
          </div>

          <p className={`text-gray-400 text-sm ${protoMono.className}`}>
            * We only collect basic activity data and do not access any sensitive health information about your habits. *
          </p>
        </div>
      </div>
    </div>
  );
} 
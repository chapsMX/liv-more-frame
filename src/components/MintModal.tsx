"use client";

import { useState } from 'react';
import { protoMono } from '../styles/fonts';
import { useUser } from '../context/UserContext';
import { CaloriesIcon, StepsIcon, SleepIcon } from '../styles/svg';
import { sdk } from "@farcaster/frame-sdk";
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { base } from 'wagmi/chains';
import { submitDelegatedAttestation } from '../utils/attestations';

interface MintModalProps {
  onClose: () => void;
  eligibleMetrics: {
    calories: boolean;
    steps: boolean;
    sleep: boolean;
  };
  dailyMetrics: {
    calories: number;
    steps: number;
    sleep: number;
  };
  userGoals: {
    steps_goal: number;
    calories_goal: number;
    sleep_hours_goal: number;
  };
  createdAttestations: {
    calories: boolean;
    steps: boolean;
    sleep: boolean;
  };
  onAttestationCreated: (metric: 'calories' | 'steps' | 'sleep') => void;
}

export default function MintModal({ 
  onClose, 
  eligibleMetrics, 
  dailyMetrics, 
  userGoals, 
  createdAttestations,
  onAttestationCreated 
}: MintModalProps) {
  const { userState } = useUser();
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  
  const [isCreatingAttestation, setIsCreatingAttestation] = useState({ 
    steps: false, 
    calories: false, 
    sleep: false 
  });
  
  const [attestationError, setAttestationError] = useState<{ 
    steps: string | null, 
    calories: string | null, 
    sleep: string | null 
  }>({ 
    steps: null, 
    calories: null, 
    sleep: null 
  });
  
  const [attestationSuccess, setAttestationSuccess] = useState<{ 
    steps: string | null, 
    calories: string | null, 
    sleep: string | null 
  }>({ 
    steps: null, 
    calories: null, 
    sleep: null 
  });

  // Constants for images
  const sleepimage = "https://tan-leading-pelican-169.mypinata.cloud/ipfs/bafkreifubmrhdminkoz4kbir43zktganyrknarka7jb3i6sgjx6k7aklwy";
  const stepsimage = "https://tan-leading-pelican-169.mypinata.cloud/ipfs/bafkreidjr3w5yzdqhafqsaynss35kiwdqa4p42fkjpnjzdnx2thkubkxxq";
  const caloriesimage = "https://tan-leading-pelican-169.mypinata.cloud/ipfs/bafkreiatwphioasnrhctap2z4uh2zj2vsohxvwpyx7mpaufuwiu2blhm5y";

  const attestationShare = async (metricType: 'steps' | 'calories' | 'sleep', attestationUID: string) => {
    try {
      let achievementText = '';
      const currentValue = dailyMetrics[metricType];
      const goalValue = metricType === 'sleep' ? userGoals.sleep_hours_goal : userGoals[`${metricType}_goal`];
      let image_url = '';
      
      if (metricType === 'sleep') image_url = sleepimage;
      else if (metricType === 'steps') image_url = stepsimage;
      else if (metricType === 'calories') image_url = caloriesimage;

      switch (metricType) {
        case 'steps':
          achievementText = `🥾 ${currentValue} steps stored onchain! 🥾\n` +
            `Walked ${currentValue} steps today, my goal was ${goalValue}.\n` +
            `One foot in front of the other, and now it's onchain.\n` +
            `Attested on @base. Let's keep moving 💪🧬\n` +
            `@livmore`;
          break;
        case 'calories':
          achievementText = `🔥 ${currentValue} calories burned & stored onchain! 🔥\n` +
            `Burned ${currentValue} kcal out of my ${goalValue} kcal goal.\n` +
            `Pushed through and now my effort is stored forever, attested on @base 🧬 💪\n` +
            `@livmore`;
          break;
        case 'sleep':
          achievementText = `😴 ${currentValue}hrs slept and stored onchain 😴\n` +
            `Slept ${currentValue} hours, beat my ${goalValue} target.\n` +
            `Rested, recharged, and now… attested.\n` +
            `Proof of sleep on @base 🛌🧬\n` +
            `@livmore`;
          break;
      }
      
      const formattedUID = attestationUID.toLowerCase();
      const url = `https://base.easscan.org/attestation/view/${formattedUID}`;
      console.log('Sharing attestation with URL:', url);
      
      await sdk.actions.composeCast({
        text: achievementText,
        embeds: [url, image_url]
      });
    } catch (error) {
      console.error('Error sharing achievement:', error);
    }
  };

  const createAttestation = async (metricType: 'steps' | 'calories' | 'sleep') => {
    setIsCreatingAttestation(prev => ({ ...prev, [metricType]: true }));
    setAttestationError(prev => ({ ...prev, [metricType]: null }));
    setAttestationSuccess(prev => ({ ...prev, [metricType]: null }));

    try {
      // 1. Get user context
      const context = await sdk.context;
      if (!context.user?.fid) {
        throw new Error('User not found');
      }

      if (!userState.ethAddress) {
        throw new Error('Wallet address not found');
      }

      // 2. Prepare attestation data
      const currentValue = dailyMetrics[metricType] || 0;
      const goalValue = metricType === 'sleep' 
        ? userGoals.sleep_hours_goal 
        : userGoals[`${metricType}_goal`] || 0;

      let image_url = '';
      if (metricType === 'sleep') image_url = sleepimage;
      else if (metricType === 'steps') image_url = stepsimage;
      else if (metricType === 'calories') image_url = caloriesimage;

      const attestationPayload = {
        fid: context.user.fid,
        name: context.user.username || "",
        display_name: context.user.displayName || context.user.username || "",
        wallet: userState.ethAddress,
        metric_type: metricType,
        goal_value: Math.floor(goalValue),
        actual_value: Math.max(1, Math.floor(currentValue)),
        timestamp: Math.floor(Date.now() / 1000),
        challenge_id: "",
        title: `${metricType.charAt(0).toUpperCase() + metricType.slice(1)} Goal Achieved`,
        description: `Achieved ${currentValue} ${metricType} out of ${goalValue} goal`,
        image_url
      };

      // 3. Submit delegated attestation
      const attestationUID = await submitDelegatedAttestation(attestationPayload);
      console.log('Attestation UID:', attestationUID);

      // 4. Save attestation to database
      try {
        const saveResponse = await fetch('/api/attestations/save-attestation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_fid: context.user.fid,
            name: context.user.username || "",
            display_name: context.user.displayName || context.user.username || "",
            wallet: userState.ethAddress,
            metric_type: metricType,
            goal_value: Math.floor(goalValue),
            actual_value: Math.max(1, Math.floor(currentValue)),
            timestamp: Math.floor(Date.now() / 1000),
            challenge_id: "",
            title: `${metricType.charAt(0).toUpperCase() + metricType.slice(1)} Goal Achieved`,
            description: `Achieved ${currentValue} ${metricType} out of ${goalValue} goal`,
            image_url: image_url,
            attestation_uid: attestationUID,
            date: new Date().toISOString().split('T')[0]
          }),
        });

        if (!saveResponse.ok) {
          const errorData = await saveResponse.json();
          throw new Error(errorData.error || 'Failed to save attestation to database');
        }

        const saveResult = await saveResponse.json();
        console.log('Attestation saved to database:', saveResult);

        onAttestationCreated(metricType);
        
        setAttestationSuccess(prev => ({ 
          ...prev, 
          [metricType]: attestationUID
        }));

      } catch (error) {
        console.error('Error saving attestation to database:', error);
        setAttestationError(prev => ({ 
          ...prev, 
          [metricType]: error instanceof Error ? error.message : 'Failed to save attestation to database' 
        }));
      }

    } catch (error) {
      console.error('Error creating attestation:', error);
      setAttestationError(prev => ({ 
        ...prev, 
        [metricType]: error instanceof Error ? error.message : 'Failed to create attestation' 
      }));
    } finally {
      setIsCreatingAttestation(prev => ({ ...prev, [metricType]: false }));
    }
  };

  const getMetricIcon = (metric: 'calories' | 'steps' | 'sleep') => {
    switch (metric) {
      case 'calories':
        return <CaloriesIcon className="w-8 h-8 text-orange-500" />;
      case 'steps':
        return <StepsIcon className="w-8 h-8 text-green-500" />;
      case 'sleep':
        return <SleepIcon className="w-8 h-8 text-blue-500" />;
    }
  };

  const getMetricValue = (metric: 'calories' | 'steps' | 'sleep') => {
    const value = dailyMetrics[metric];
    const goal = metric === 'sleep' ? userGoals.sleep_hours_goal : userGoals[`${metric}_goal`];
    const unit = metric === 'sleep' ? 'h' : '';
    return `${value}/${goal}${unit}`;
  };

  // Filter metrics that are eligible and not already created
  const availableMetrics = (['calories', 'steps', 'sleep'] as const).filter(
    metric => eligibleMetrics[metric] && !createdAttestations[metric]
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border-2 border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className={`text-2xl font-bold text-white ${protoMono.className}`}>
            Mint Attestations
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Wallet Connection Section */}
        <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className={`text-sm ${protoMono.className} ${isConnected ? 'text-green-400' : 'text-gray-400'}`}>
                {isConnected ? `Connected: ${address?.slice(0, 6)}...${address?.slice(-4)}` : 'Wallet not connected'}
              </span>
            </div>
            
            {isConnected ? (
              <button
                onClick={() => disconnect()}
                className={`px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors ${protoMono.className}`}
              >
                Disconnect
              </button>
                         ) : (
               <div className="flex flex-col space-y-2">
                 {connectors.map((connector) => (
                   <button
                     key={connector.uid}
                     onClick={() => connect({ connector })}
                     disabled={!connector.id}
                     className={`px-3 py-2 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded transition-colors disabled:opacity-50 ${protoMono.className} w-full`}
                   >
                     {connector.name}
                   </button>
                 ))}
               </div>
             )}
          </div>
          
          {chain && chain.id !== base.id && (
            <div className="mt-2 text-xs text-orange-400">
              ⚠️ Please switch to Base network to mint attestations
            </div>
          )}
        </div>

        {!isConnected ? (
          <div className="text-center py-8">
            <p className={`text-gray-400 mb-4 ${protoMono.className}`}>
              Connect your wallet to mint attestations
            </p>
            <div className="flex flex-col space-y-3 max-w-xs mx-auto">
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => connect({ connector })}
                  disabled={!connector.id}
                  className={`px-4 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors disabled:opacity-50 ${protoMono.className} w-full`}
                >
                  {connector.name}
                </button>
              ))}
            </div>
          </div>
        ) : availableMetrics.length === 0 ? (
          <div className="text-center py-8">
            <p className={`text-gray-400 ${protoMono.className}`}>
              No attestations available to mint
            </p>
          </div>
        ) : (
          <>
            <p className={`text-gray-300 mb-6 ${protoMono.className}`}>
              Select which achievement you would like to attest onchain:
            </p>

            <div className="space-y-4">
              {availableMetrics.map((metric) => {
                const isCreating = isCreatingAttestation[metric];
                const hasError = attestationError[metric];
                const hasSuccess = attestationSuccess[metric];
                
                return (
                  <div key={metric} className="space-y-2">
                    <button
                      onClick={() => createAttestation(metric)}
                      disabled={isCreating}
                      className={`w-full p-4 rounded-xl border-2 transition-all duration-300 ${
                        isCreating
                          ? 'border-gray-600 bg-gray-800 cursor-not-allowed'
                          : hasSuccess
                            ? 'border-green-500 bg-green-900/20'
                            : hasError
                              ? 'border-red-500 bg-red-900/20'
                              : 'border-[#00FF94] bg-[#1A1A1A] hover:bg-[#2A2A2A] hover:scale-105'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {getMetricIcon(metric)}
                          <div className="text-left">
                            <p className={`text-white font-semibold ${protoMono.className}`}>
                              {metric.charAt(0).toUpperCase() + metric.slice(1)}
                            </p>
                            <p className={`text-gray-400 text-sm ${protoMono.className}`}>
                              {getMetricValue(metric)}
                            </p>
                          </div>
                        </div>
                        
                        {isCreating ? (
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#00FF94]"></div>
                        ) : hasSuccess ? (
                          <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : hasError ? (
                          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        ) : (
                          <span className={`text-[#00FF94] text-sm ${protoMono.className}`}>
                            Mint
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Error Message */}
                    {hasError && (
                      <p className={`text-red-500 text-sm ${protoMono.className}`}>
                        {hasError}
                      </p>
                    )}

                    {/* Success Message with Share Button */}
                    {hasSuccess && (
                      <div className="bg-green-900/20 border border-green-500 rounded-lg p-3">
                        <p className={`text-green-500 text-sm mb-2 ${protoMono.className}`}>
                          ✅ Attestation created successfully!
                        </p>
                        <button
                          onClick={() => attestationShare(metric, hasSuccess)}
                          className={`text-sm text-green-400 hover:text-green-300 transition-colors ${protoMono.className}`}
                        >
                          📢 Share on Farcaster
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface UserState {
  isWhitelisted: boolean;
  acceptedTos: boolean;
  acceptedPrivacyPolicy: boolean;
  canUse: boolean;
  username?: string;
  displayName?: string;
  userFid?: number;
  ethAddress?: string;
  connectedProvider?: string;
}

interface UserContextType {
  userState: UserState;
  setUserState: (state: Partial<UserState>) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  updateUserLegalStatus: (acceptedTos: boolean, acceptedPrivacyPolicy: boolean) => Promise<void>;
}

const initialState: UserState = {
  isWhitelisted: false,
  acceptedTos: false,
  acceptedPrivacyPolicy: false,
  canUse: false,
  connectedProvider: undefined,
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userState, setUserStateInternal] = useState<UserState>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('livmore_user_state');
      return saved ? JSON.parse(saved) : initialState;
    }
    return initialState;
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('livmore_user_state', JSON.stringify(userState));
    }
  }, [userState]);

  const setUserState = (newState: Partial<UserState>) => {
    setUserStateInternal(prev => ({
      ...prev,
      ...newState
    }));
  };

  const updateUserLegalStatus = async (acceptedTos: boolean, acceptedPrivacyPolicy: boolean) => {
    try {
      setIsLoading(true);
      if (!userState.userFid) {
        console.error('No user FID found when updating legal status');
        return;
      }

      const response = await fetch('/api/users/update-legal-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_fid: userState.userFid,
          accepted_tos: acceptedTos,
          accepted_privacy_policy: acceptedPrivacyPolicy,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setUserState({
          acceptedTos,
          acceptedPrivacyPolicy,
        });
        console.log('Legal status updated successfully');
      } else {
        console.error('Failed to update legal status:', data.error);
      }
    } catch (error) {
      console.error('Error updating legal status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <UserContext.Provider value={{
      userState,
      setUserState,
      isLoading,
      setIsLoading,
      updateUserLegalStatus,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
} 
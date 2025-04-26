"use client";

import { useEffect, useState } from "react";
import { protoMono } from '../styles/fonts';
import { CaloriesIcon, StepsIcon, SleepIcon } from '../styles/svg/index';
import { ActivityData } from './DashboardBase';
import GoalsModal from './GoalsModal';
import ConnectDeviceModal from './ConnectDeviceModal';
import Loader from './Loader';

interface UserGoals {
  calories_goal: number;
  steps_goal: number;
  sleep_hours_goal: number;
}

export default function DashboardGarmin() {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hasGoals, setHasGoals] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [goals, setGoals] = useState<UserGoals | null>(null);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [userFid, setUserFid] = useState('');
  const [weeklyStats, setWeeklyStats] = useState<Array<{
    date: string;
    calories: number;
    steps: number;
    sleep: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ... Aquí irían todas las funciones específicas de Garmin ...
  // handleGarminConnect, fetchActivityData, fetchWeeklyData, etc.

  if (isTransitioning) {
    return <Loader message="Updating your data..." />;
  }

  return (
    <div>
      {/* Aquí iría todo el contenido específico del dashboard de Garmin */}
      {/* Podemos mover todo el contenido del return del Dashboard.tsx aquí */}
      <div>Dashboard Garmin en construcción...</div>
    </div>
  );
} 
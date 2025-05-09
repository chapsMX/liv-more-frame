"use client";

import { useEffect, useState, useCallback } from "react";
import { protoMono } from '../styles/fonts';
import sdk from "@farcaster/frame-sdk";
import GoalsModal from './GoalsModal';
import Loader from './Loader';
import DashboardBase from './DashboardBase';
// Importación no usada, podemos eliminarla
// import DailyActivity from './DailyActivity';

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hasGoals, setHasGoals] = useState(false);
  const [userFid, setUserFid] = useState('');
  
  // Estos datos ya no son necesarios porque DailyActivity los carga por su cuenta
  // Los mantenemos por ahora para no romper otras partes del código
  const [activityData, setActivityData] = useState<{
    calories: number;
    steps: number;
    sleepHours: number;
  }>({
    calories: 320,
    steps: 8500,
    sleepHours: 7.5
  });

  const checkUserGoals = useCallback(async () => {
    try {
      if (!userFid) {
        console.log('FID no disponible en el estado del Dashboard');
        return;
      }

      setIsTransitioning(true);
      const response = await fetch(`/api/goals/check?user_fid=${userFid}`);
      const data = await response.json();
      
      if (data.hasGoals) {
        setHasGoals(true);
      } else {
        setHasGoals(false);
      }
    } catch (error) {
      console.error('Error checking user goals:', error);
    } finally {
      setIsTransitioning(false);
    }
  }, [userFid]);

  const handleSaveGoals = async (newGoals: { calories: number; steps: number; sleep: number }) => {
    try {
      if (!userFid) return;

      const response = await fetch('/api/goals/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_fid: userFid,
          calories_goal: newGoals.calories,
          steps_goal: newGoals.steps,
          sleep_hours_goal: newGoals.sleep
        }),
      });

      const data = await response.json();
      if (data.success) {
        setHasGoals(true);
      }
    } catch (error) {
      console.error('Error saving goals:', error);
    }
  };

  // Esta función ya no es necesaria, pero la mantenemos por compatibilidad
  const fetchActivityData = useCallback(async () => {
    try {
      if (!userFid) return;
      
      // Los datos ahora los carga directamente el componente DailyActivity
      console.log('DailyActivity ahora carga sus propios datos para el usuario:', userFid);
      
    } catch (error) {
      console.error('Error fetching activity data:', error);
    }
  }, [userFid]);

  useEffect(() => {
    const load = async () => {
      try {
        const context = await sdk.context;
        console.log('Dashboard context:', context);
        
        if (context.user?.fid) {
          const fid = context.user.fid.toString();
          console.log('Dashboard FID:', fid);
          setUserFid(fid);
        } else {
          console.log('Esperando FID en Dashboard...');
        }
      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (userFid) {
      checkUserGoals();
      fetchActivityData();
    }
  }, [userFid, checkUserGoals, fetchActivityData]);

  if (isLoading) {
    return <Loader message="Loading dashboard..." />;
  }

  if (isTransitioning) {
    return <Loader message="Updating your data..." />;
  }

  if (!hasGoals) {
    return <GoalsModal onSave={handleSaveGoals} />;
  }

  // Siempre mostramos DashboardBase independientemente del proveedor
  // Sin renderizar DailyActivity aquí, ya que ya está incluido en DashboardBase
  return (
    <DashboardBase>
      {/* Proporcionamos un contenido vacío pero válido como children */}
      <div className="w-full max-w-2xl mx-auto">
        {/* Contenido adicional del dashboard si es necesario */}
      </div>
    </DashboardBase>
  );
} 
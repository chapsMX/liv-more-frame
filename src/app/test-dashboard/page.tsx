"use client";

import { useState } from 'react';
import RookDataDisplay from '@/components/RookDataDisplay';

export default function TestDashboardPage() {
  const [userFid, setUserFid] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showData, setShowData] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowData(true);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard de Prueba - Datos de Rook</h1>
      
      <form onSubmit={handleSubmit} className="mb-8 p-4 border rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="userFid" className="block mb-2">ID de Usuario (user_fid):</label>
            <input
              type="text"
              id="userFid"
              value={userFid}
              onChange={(e) => setUserFid(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          
          <div>
            <label htmlFor="date" className="block mb-2">Fecha:</label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
        </div>
        
        <button 
          type="submit" 
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Ver Datos
        </button>
      </form>
      
      {showData && userFid && (
        <RookDataDisplay userFid={userFid} date={date} />
      )}
    </div>
  );
} 
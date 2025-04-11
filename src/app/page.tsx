import { Metadata } from "next";
import { Suspense } from 'react';
import LivMore from '@/components/LivMore';
import Goals from '@/components/Goals';
import Dashboard from '@/components/Dashboard';
import { neon } from '@neondatabase/serverless';
import { redirect } from 'next/navigation';
import { ReadonlyURLSearchParams } from 'next/navigation';

const appUrl = process.env.NEXT_PUBLIC_URL;
const sql = neon(process.env.DATABASE_URL!);

const frame = {
  version: "next",
  imageUrl: `${appUrl}/frameImage.jpg`,
  button: {   
    title: "Join Liv More Whitelist",
    action: {
      type: "launch_frame",
      name: "Liv More",
      url: appUrl,
      splashImageUrl: `${appUrl}/splash.png`,
      splashBackgroundColor: "#101827",
    },
  },
};

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Liv More",
    openGraph: {
      title: "Liv More",
      description: "Turn Healty Habitos Into Rewards",
    },
    other: {
      "fc:frame": JSON.stringify(frame),
    },
  };
}

interface Props {
  searchParams: { [key: string]: string | undefined };
}

export default async function Home({ searchParams }: Props) {
  try {
    // Aseguramos que searchParams esté disponible antes de usarlo
    const params = await Promise.resolve(searchParams);
    const userFid = params?.fid;

    if (!userFid) {
      return <LivMore />;
    }

    // Verificar si el usuario está en la whitelist y obtener su displayName
    const userCheck = await sql`
      SELECT 
        wu.is_whitelisted,
        wu.display_name
      FROM whitelist_users wu
      WHERE wu.user_fid = ${parseInt(userFid)}
    `;

    if (userCheck.length === 0 || !userCheck[0].is_whitelisted) {
      return <LivMore />;
    }

    // Verificar si el usuario ya tiene objetivos establecidos
    const goalsCheck = await sql`
      SELECT has_goals FROM user_connections WHERE user_fid = ${parseInt(userFid)}
    `;

    const hasGoals = goalsCheck.length > 0 && goalsCheck[0].has_goals;

    const handleGoalsSaved = () => {
      redirect(`/?fid=${userFid}`);
    };

    return (
      <main className="flex min-h-screen flex-col items-center justify-between p-24">
        <Suspense fallback={<div>Cargando...</div>}>
          {hasGoals ? (
            <Dashboard userFid={userFid} />
          ) : (
            <Goals 
              onSave={handleGoalsSaved}
              displayName={userCheck[0].display_name || 'Usuario'}
            />
          )}
        </Suspense>
      </main>
    );
  } catch (error) {
    console.error('Error en Home:', error);
    return <LivMore />;
  }
}
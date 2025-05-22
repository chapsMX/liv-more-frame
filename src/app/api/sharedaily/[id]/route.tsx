import { loadImage } from "@/lib/og-utils";
import { neon } from '@neondatabase/serverless';
import { ImageResponse } from 'next/og';
import { CaloriesIcon, StepsIcon, SleepIcon } from '../../../../../src/styles/svg/index';
import fs from 'fs';
import path from 'path';

const sql = neon(process.env.DATABASE_URL!);
export const dynamic = 'force-dynamic';

const size = {
  width: 1200,
  height: 800,
};

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
  // 0. Obtener id de la ruta, user y url
    const { id } = await params;
  const [user_fid] = id.split('-'); // Solo el número antes del guion
    const appUrl = process.env.NEXT_PUBLIC_URL;
  // 1. Obtener rook_user_id
  const rookUserRes = await fetch(`${appUrl}/api/users/get-rook-user?fid=${user_fid}`);
  const rookUserData = await rookUserRes.json();
  const rookUserId = rookUserData.rook_user_id;
  // 2. Obtener fecha de hoy (en la zona horaria correcta)
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  // 3. Obtener métricas físicas
  const physicalRes = await fetch(`${appUrl}/api/users/physical-summary?user_id=${rookUserId}&date=${dateStr}`);
  const physicalData = await physicalRes.json();
  // 4. Obtener métricas de sueño
  const sleepRes = await fetch(`${appUrl}/api/users/sleep-summary?user_id=${rookUserId}&date=${dateStr}`);
  const sleepData = await sleepRes.json();
  // 5. Usar los datos
  const steps = physicalData.steps || 0;
  const calories = physicalData.calories || 0;
  const sleep = sleepData.sleep_duration_hours || 0;
  // Cargar fondo livMore_w.png usando loadImage utilitario
  const logoLivMore = await loadImage(`${appUrl}/dailyShare.png`);
  // Cargar fuente ProtoMono
  const fontPath = path.join(process.cwd(), 'src/styles/fonts/ProtoMono-Regular.otf');
  const fontData = fs.readFileSync(fontPath);
  // Consultar metas
  const goalsRes = await sql`
    SELECT steps_goal, calories_goal, sleep_hours_goal FROM user_goals WHERE user_fid = ${user_fid} LIMIT 1
  `;
  const goalSteps = goalsRes[0]?.steps_goal || 0;
  const goalCalories = goalsRes[0]?.calories_goal || 0;
  const goalSleep = goalsRes[0]?.sleep_hours_goal || 0;

  // Formato de fecha largo en inglés
  const dateFormatted = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Colores
  const colorCalories = '#FF8800';
  const colorSteps = '#3DDC97';
  const colorSleep = '#3B82F6';
  const colorText = '#fff';
  const colorWhite = '#fff';

    return new ImageResponse(
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
      justifyContent: "space-between",
      padding: "40px",
      backgroundImage: `url(data:image/png;base64,${Buffer.from(logoLivMore).toString('base64')})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundColor: "#101827",
          }}
        >
      {/* Contenido principal */}
      <div style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {/* Título */}
        <div style={{ display: 'flex', fontFamily: 'ProtoMono', color: colorWhite, fontSize: 80, fontWeight: 700, marginBottom: 16, letterSpacing: 2, textAlign: 'center' }}>
          Daily Activity
        </div>
        {/* Fecha */}
        <div style={{ display: 'flex', fontFamily: 'ProtoMono', color: colorText, fontSize: 60, marginBottom: 48, textAlign: 'center' }}>
          {dateFormatted}
        </div>
        {/* Íconos y contadores */}
        <div style={{ display: 'flex', flexDirection: 'row', gap: 80, marginBottom: 0 }}>
          {/* Calorías */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', width: 250, height: 250, borderRadius: '50%', border: `8px solid ${colorCalories}`, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <CaloriesIcon style={{ width: 120, height: 120, color: colorCalories }} />
            </div>
            <div style={{ display: 'flex', fontFamily: 'ProtoMono', fontSize: 40, color: colorWhite, fontWeight: 700, letterSpacing: 1 }}>
              {calories.toLocaleString()}
              <span style={{ color: colorText, fontWeight: 400, fontSize: 40 }}>
                /{goalCalories.toLocaleString()}
              </span>
            </div>
            <div style={{ display: 'flex', fontFamily: 'ProtoMono', fontSize: 28, color: colorText, marginTop: 8, letterSpacing: 2 }}>CALORIES</div>
          </div>
          {/* Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', width: 250, height: 250, borderRadius: '50%', border: `8px solid ${colorSteps}`, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <StepsIcon style={{ width: 120, height: 120, color: colorSteps }} />
            </div>
            <div style={{ display: 'flex', fontFamily: 'ProtoMono', fontSize: 40, color: colorWhite, fontWeight: 700, letterSpacing: 1 }}>
              {steps.toLocaleString()}
              <span style={{ color: colorText, fontWeight: 400, fontSize: 40 }}>
                /{goalSteps.toLocaleString()}
              </span>
            </div>
            <div style={{ display: 'flex', fontFamily: 'ProtoMono', fontSize: 28, color: colorText, marginTop: 8, letterSpacing: 2 }}>STEPS</div>
          </div>
          {/* Sleep */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', width: 250, height: 250, borderRadius: '50%', border: `8px solid ${colorSleep}`, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <SleepIcon style={{ width: 120, height: 120, color: colorSleep }} />
            </div>
            <div style={{ display: 'flex', fontFamily: 'ProtoMono', fontSize: 40, color: colorWhite, fontWeight: 700, letterSpacing: 1 }}>
              {sleep}
              <span style={{ color: colorText, fontWeight: 400, fontSize: 40 }}>/{goalSleep}h</span>
            </div>
            <div style={{ display: 'flex', fontFamily: 'ProtoMono', fontSize: 28, color: colorText, marginTop: 8, letterSpacing: 2 }}>SLEEP</div>
          </div>
        </div>
      </div>
    </div>,
      {
        ...size,
        fonts: [
          {
          name: 'ProtoMono',
            data: fontData,
          weight: 700,
          style: 'normal',
          },
        ],
      }
    );
  } catch (e) {
  console.log(`Failed to generate image`, e);
  return new Response(`Failed to generate image`, {
      status: 500,
    });
  }
}
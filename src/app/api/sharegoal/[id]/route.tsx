import { loadImage } from "@/lib/og-utils";
import { neon } from '@neondatabase/serverless';
import { ImageResponse } from 'next/og';
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
    
    // 1. Obtener los objetivos del usuario desde la base de datos
    const goalsRes = await sql`
      SELECT steps_goal, calories_goal, sleep_hours_goal FROM user_goals WHERE user_fid = ${user_fid} LIMIT 1
    `;
    
    if (goalsRes.length === 0) {
      throw new Error('User goals not found');
    }
    
    const goalSteps = goalsRes[0]?.steps_goal || 0;
    const goalCalories = goalsRes[0]?.calories_goal || 0;
    const goalSleep = goalsRes[0]?.sleep_hours_goal || 0;

    // 2. Contar total de usuarios en whitelist_users
    const totalUsersRes = await sql`
      SELECT COUNT(*) as total FROM whitelist_users
    `;
    const totalUsers = totalUsersRes[0]?.total || 0;

    // 3. Seleccionar más usuarios aleatorios para filtrar los que tienen PFP
    const randomUsersRes = await sql`
      SELECT user_fid FROM whitelist_users 
      WHERE user_fid < 15000 
      ORDER BY RANDOM() 
      LIMIT 15
    `;

    // 4. Obtener información del usuario principal desde Neynar
    let userPfp = '';
    let username = 'User';
    try {
      const neynarResponse = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${user_fid}`, {
        headers: {
          'x-api-key': process.env.NEYNAR_API_KEY || '',
        },
      });
      
      if (neynarResponse.ok) {
        const neynarData = await neynarResponse.json();
        if (neynarData.users && neynarData.users[0]) {
          userPfp = neynarData.users[0].pfp_url || '';
          username = neynarData.users[0].username || neynarData.users[0].display_name || 'User';
        }
      }
    } catch (error) {
      console.log('Error fetching user from Neynar:', error);
    }

    // 5. Obtener PFPs de los usuarios aleatorios desde Neynar y filtrar solo los que tienen PFP
    let randomUsersPfps = [];
    if (randomUsersRes.length > 0) {
      try {
        const randomFids = randomUsersRes.map(u => u.user_fid).join(',');
        const neynarRandomResponse = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${randomFids}`, {
          headers: {
            'x-api-key': process.env.NEYNAR_API_KEY || '',
          },
        });
        
        if (neynarRandomResponse.ok) {
          const neynarRandomData = await neynarRandomResponse.json();
          // Filtrar solo usuarios que tienen pfp_url válido
          randomUsersPfps = (neynarRandomData.users || []).filter((user: any) => 
            user.pfp_url && user.pfp_url.trim() !== ''
          ).slice(0, 5); // Tomar solo los primeros 5 con PFP válido
        }
      } catch (error) {
        console.log('Error fetching random users from Neynar:', error);
      }
    }
    
    // 6. Seleccionar imagen de fondo aleatoria entre sh_01.png y sh_05.png
    const randomImageNumber = Math.floor(Math.random() * 5) + 1; // 1-5
    const backgroundImageName = `sh_0${randomImageNumber}.png`;
    const logoLivMore = await loadImage(`${appUrl}/${backgroundImageName}`);
    
    console.log(`Using background image: ${backgroundImageName}`);
    
    // Cargar fuente ProtoMono
    const fontPath = path.join(process.cwd(), 'src/styles/fonts/ProtoMono-Regular.otf');
    const fontData = fs.readFileSync(fontPath);

    // Cargar pfp del usuario principal si existe
    let userPfpBuffer = null;
    if (userPfp) {
      try {
        userPfpBuffer = await loadImage(userPfp);
      } catch (error) {
        console.log('Error loading user pfp:', error);
      }
    }

    // Cargar PFPs de usuarios aleatorios
    const randomPfpBuffers = [];
    for (const user of randomUsersPfps) {
      if (user.pfp_url) {
        try {
          const pfpBuffer = await loadImage(user.pfp_url);
          randomPfpBuffers.push(pfpBuffer);
        } catch (error) {
          console.log('Error loading random user pfp:', error);
          randomPfpBuffers.push(null);
        }
      } else {
        randomPfpBuffers.push(null);
      }
    }

    // Colores para los objetivos
    const colorCalories = '#FF8800'; // Naranja
    const colorSteps = '#3DDC97';    // Verde
    const colorSleep = '#3B82F6';    // Azul

    return new ImageResponse(
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "flex-start",
            padding: "30px",
            backgroundImage: `url(data:image/png;base64,${Buffer.from(logoLivMore).toString('base64')})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat"
          }}
        >
          {/* Fila 1: Social Accountability */}
          <div style={{ 
            display: 'flex', 
            fontFamily: 'ProtoMono', 
            color: '#FFFFFF', 
            fontSize: 62, 
            fontWeight: 700,
            marginBottom: 20
          }}>
            Social Accountability
          </div>

          {/* Fila 2: These are my goals */}
          <div style={{ 
            display: 'flex', 
            fontFamily: 'ProtoMono', 
            color: '#8B5CF6', 
            fontSize: 48, 
            fontWeight: 600,
            marginBottom: 20
          }}>
            These are my goals
          </div>

          {/* Fila 3: PFP del usuario */}
          <div style={{
            display: 'flex',
            marginBottom: 40
          }}>
            {userPfpBuffer ? (
              <div style={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                overflow: 'hidden',
                border: '4px solid #FFFFFF',
                display: 'flex'
              }}>
                <img
                  src={`data:image/png;base64,${Buffer.from(userPfpBuffer).toString('base64')}`}
                  width={120}
                  height={120}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              </div>
            ) : (
              <div style={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                backgroundColor: '#4B5563',
                border: '4px solid #FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{ 
                  display: 'flex', 
                  fontFamily: 'ProtoMono', 
                  color: '#FFFFFF', 
                  fontSize: 24 
                }}>
                  {username.charAt(0).toUpperCase()}
                </div>
              </div>
            )}
          </div>

          {/* Fila 4: Círculo naranja - Daily calories */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 16,
            marginBottom: 20
          }}>
            <div style={{ 
              width: 24, 
              height: 24, 
              borderRadius: '50%', 
              backgroundColor: colorCalories 
            }}></div>
            <div style={{ 
              display: 'flex', 
              fontFamily: 'ProtoMono', 
              color: '#FFFFFF', 
              fontSize: 32, 
              fontWeight: 700 
            }}>
              {goalCalories.toLocaleString()} daily calories
            </div>
          </div>

          {/* Fila 5: Círculo verde - Daily steps */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 16,
            marginBottom: 20
          }}>
            <div style={{ 
              width: 24, 
              height: 24, 
              borderRadius: '50%', 
              backgroundColor: colorSteps 
            }}></div>
            <div style={{ 
              display: 'flex', 
              fontFamily: 'ProtoMono', 
              color: '#FFFFFF', 
              fontSize: 32, 
              fontWeight: 700 
            }}>
              {goalSteps.toLocaleString()} daily steps
            </div>
          </div>

          {/* Fila 6: Círculo azul - Sleep hours */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 16,
            marginBottom: 40
          }}>
            <div style={{ 
              width: 24, 
              height: 24, 
              borderRadius: '50%', 
              backgroundColor: colorSleep 
            }}></div>
            <div style={{ 
              display: 'flex', 
              fontFamily: 'ProtoMono', 
              color: '#FFFFFF', 
              fontSize: 32, 
              fontWeight: 700 
            }}>
              {goalSleep} sleep hours
            </div>
          </div>

          {/* Fila 7: 5 usuarios aleatorios + conteo total */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12
          }}>
            {/* 5 PFPs de usuarios aleatorios */}
            <div style={{ 
              display: 'flex', 
              gap: 0
            }}>
              {randomPfpBuffers.slice(0, 5).map((pfpBuffer, index) => (
                <div key={index} style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '2px solid #FFFFFF',
                  display: 'flex',
                  backgroundColor: pfpBuffer ? 'transparent' : '#4B5563',
                  marginLeft: index > 0 ? '-12px' : '0px',
                  zIndex: 5 - index
                }}>
                  {pfpBuffer ? (
                    <img
                      src={`data:image/png;base64,${Buffer.from(pfpBuffer).toString('base64')}`}
                      width={80}
                      height={80}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                      fontSize: 16
                    }}>
                      ?
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Texto con conteo total */}
            <div style={{ 
              display: 'flex', 
              fontFamily: 'ProtoMono', 
              color: '#FFFFFF', 
              fontSize: 32, 
              fontWeight: 600 
            }}>
              +{totalUsers.toLocaleString()} users {/* have joined Liv More */}
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
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Inicializar Firebase Admin
function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

async function sendReminderEmail(to: string, playerName: string, matchData: {
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  location: string;
  isHome: boolean;
}) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Padel Friends <notificaciones@padelFriends.com>',
      to,
      subject: `⏰ Partido mañana: ${matchData.homeTeam} vs ${matchData.awayTeam}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="margin:0;padding:0;background:#0a0a0f;font-family:Inter,sans-serif;color:#f0f0f5;">
          <div style="max-width:480px;margin:0 auto;padding:32px 16px;">
            
            <!-- Header -->
            <div style="text-align:center;margin-bottom:32px;">
              <div style="width:64px;height:64px;background:#00e5a0;border-radius:16px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
                <span style="font-size:32px;">🏆</span>
              </div>
              <h1 style="font-size:28px;font-weight:900;letter-spacing:0.05em;margin:0;color:#f0f0f5;">PADEL FRIENDS</h1>
            </div>

            <!-- Card -->
            <div style="background:#13131a;border:1px solid #2a2a3d;border-radius:20px;overflow:hidden;">
              
              <!-- Top bar -->
              <div style="height:4px;background:linear-gradient(90deg,#00e5a0,#7c3aed);"></div>
              
              <div style="padding:28px 24px;">
                <div style="background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:10px 16px;display:inline-block;margin-bottom:20px;">
                  <span style="color:#f59e0b;font-weight:700;font-size:14px;">⏰ PARTIDO MAÑANA</span>
                </div>
                
                <p style="color:#8888a8;font-size:14px;margin:0 0 8px;">Hola <strong style="color:#f0f0f5;">${playerName}</strong>,</p>
                <p style="color:#8888a8;font-size:14px;margin:0 0 24px;">Tienes un partido programado para mañana. ¡Prepárate!</p>

                <!-- Match -->
                <div style="background:#1c1c28;border-radius:14px;padding:20px;margin-bottom:20px;text-align:center;">
                  <p style="margin:0 0 4px;font-size:13px;color:#8888a8;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Partido</p>
                  <p style="margin:0;font-size:22px;font-weight:800;color:#f0f0f5;">
                    ${matchData.homeTeam}
                  </p>
                  <p style="margin:8px 0;font-size:16px;color:#8888a8;font-weight:700;">vs</p>
                  <p style="margin:0;font-size:22px;font-weight:800;color:#f0f0f5;">
                    ${matchData.awayTeam}
                  </p>
                  <div style="margin-top:12px;display:inline-block;background:${matchData.isHome ? 'rgba(0,229,160,0.15)' : 'rgba(124,58,237,0.15)'};border-radius:6px;padding:4px 12px;">
                    <span style="font-size:12px;font-weight:700;color:${matchData.isHome ? '#00e5a0' : '#7c3aed'};">
                      ${matchData.isHome ? '🏠 Juegas de LOCAL' : '✈️ Juegas de VISITANTE'}
                    </span>
                  </div>
                </div>

                <!-- Details -->
                <div style="display:flex;flex-direction:column;gap:12px;">
                  <div style="display:flex;align-items:center;gap:12px;background:#1c1c28;border-radius:10px;padding:14px;">
                    <span style="font-size:20px;">📅</span>
                    <div>
                      <p style="margin:0;font-size:11px;color:#8888a8;text-transform:uppercase;letter-spacing:0.06em;font-weight:700;">Fecha y hora</p>
                      <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#f0f0f5;">${matchData.date} · ${matchData.time}h</p>
                    </div>
                  </div>
                  <div style="display:flex;align-items:center;gap:12px;background:#1c1c28;border-radius:10px;padding:14px;">
                    <span style="font-size:20px;">📍</span>
                    <div>
                      <p style="margin:0;font-size:11px;color:#8888a8;text-transform:uppercase;letter-spacing:0.06em;font-weight:700;">Ubicación</p>
                      <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#f0f0f5;">${matchData.location}</p>
                    </div>
                  </div>
                </div>

                <!-- CTA -->
                <div style="margin-top:24px;text-align:center;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://padelfriends.vercel.app'}/dashboard/schedule" 
                     style="display:inline-block;background:#00e5a0;color:#000;font-weight:800;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;letter-spacing:0.03em;">
                    Ver partido en la app →
                  </a>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <p style="text-align:center;color:#8888a8;font-size:12px;margin-top:24px;">
              Padel Friends · Gestión de campeonatos 🎾
            </p>
          </div>
        </body>
        </html>
      `,
    }),
  });

  return res.ok;
}

export async function GET(request: NextRequest) {
  // Verificar que es Vercel Cron (seguridad)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getAdminDb();

    // Buscar partidos en las próximas 24-26 horas (ventana de 2h para no repetir)
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in26h = new Date(now.getTime() + 26 * 60 * 60 * 1000);

    const matchesSnap = await db.collection('matches')
      .where('status', '==', 'scheduled')
      .where('reminderSent', '==', false)
      .where('scheduledDate', '>=', Timestamp.fromDate(in24h))
      .where('scheduledDate', '<=', Timestamp.fromDate(in26h))
      .get();

    if (matchesSnap.empty) {
      return NextResponse.json({ message: 'No matches to remind', count: 0 });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const matchDoc of matchesSnap.docs) {
      const match = matchDoc.data();

      try {
        const matchDate = (match.scheduledDate as Timestamp).toDate();
        const dateStr = matchDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        const timeStr = matchDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const location = match.locationOverride || match.location || 'Por confirmar';

        // Obtener datos de los equipos
        const [homeTeamDoc, awayTeamDoc] = await Promise.all([
          db.collection('teams').doc(match.homeTeamId).get(),
          db.collection('teams').doc(match.awayTeamId).get(),
        ]);

        const homeTeam = homeTeamDoc.data();
        const awayTeam = awayTeamDoc.data();

        // Enviar a jugadores del equipo local
        if (homeTeam) {
          const playersToNotify = [
            { name: homeTeam.player1Name, email: homeTeam.player1Email },
            { name: homeTeam.player2Name, email: homeTeam.player2Email },
          ].filter(p => p.email);

          for (const player of playersToNotify) {
            const ok = await sendReminderEmail(player.email, player.name || 'Jugador', {
              homeTeam: match.homeTeamName,
              awayTeam: match.awayTeamName,
              date: dateStr,
              time: timeStr,
              location,
              isHome: true,
            });
            if (ok) {
              sent++;
              // Crear notificación en Firestore también
              const userSnap = await db.collection('users')
                .where('email', '==', player.email).limit(1).get();
              if (!userSnap.empty) {
                await db.collection('notifications').add({
                  userId: userSnap.docs[0].id,
                  type: 'match_reminder',
                  title: '⏰ Partido mañana',
                  message: `${match.homeTeamName} vs ${match.awayTeamName} · ${timeStr}h · ${location}`,
                  read: false,
                  matchId: matchDoc.id,
                  createdAt: Timestamp.now(),
                });
              }
            }
          }
        }

        // Enviar a jugadores del equipo visitante
        if (awayTeam) {
          const playersToNotify = [
            { name: awayTeam.player1Name, email: awayTeam.player1Email },
            { name: awayTeam.player2Name, email: awayTeam.player2Email },
          ].filter(p => p.email);

          for (const player of playersToNotify) {
            const ok = await sendReminderEmail(player.email, player.name || 'Jugador', {
              homeTeam: match.homeTeamName,
              awayTeam: match.awayTeamName,
              date: dateStr,
              time: timeStr,
              location,
              isHome: false,
            });
            if (ok) {
              sent++;
              const userSnap = await db.collection('users')
                .where('email', '==', player.email).limit(1).get();
              if (!userSnap.empty) {
                await db.collection('notifications').add({
                  userId: userSnap.docs[0].id,
                  type: 'match_reminder',
                  title: '⏰ Partido mañana',
                  message: `${match.homeTeamName} vs ${match.awayTeamName} · ${timeStr}h · ${location}`,
                  read: false,
                  matchId: matchDoc.id,
                  createdAt: Timestamp.now(),
                });
              }
            }
          }
        }

        // Marcar partido como recordatorio enviado
        await matchDoc.ref.update({ reminderSent: true });

      } catch (err) {
        errors.push(`Match ${matchDoc.id}: ${err}`);
      }
    }

    return NextResponse.json({
      message: `Reminders sent`,
      sent,
      matches: matchesSnap.size,
      errors,
    });

  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

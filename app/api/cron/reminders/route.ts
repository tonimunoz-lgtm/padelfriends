import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { homeTeam, awayTeam, opponentTeam, postponeType, newDate } = await request.json();

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ ok: false, reason: 'No RESEND_API_KEY configured' });
    }

    const emails = [opponentTeam.player1Email, opponentTeam.player2Email].filter(Boolean);
    if (!emails.length) {
      return NextResponse.json({ ok: false, reason: 'No opponent emails found' });
    }

    const newDateStr = newDate
      ? new Date(newDate).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
      : null;

    const subject = `⚠️ Partido aplazado: ${homeTeam} vs ${awayTeam}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body style="margin:0;padding:0;background:#0a0a0f;font-family:Inter,sans-serif;color:#f0f0f5;">
        <div style="max-width:480px;margin:0 auto;padding:32px 16px;">

          <div style="text-align:center;margin-bottom:32px;">
            <div style="width:64px;height:64px;background:#f59e0b;border-radius:16px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
              <span style="font-size:32px;">⏸</span>
            </div>
            <h1 style="font-size:28px;font-weight:900;letter-spacing:0.05em;margin:0;color:#f0f0f5;">PADEL FRIENDS</h1>
          </div>

          <div style="background:#13131a;border:1px solid #2a2a3d;border-radius:20px;overflow:hidden;">
            <div style="height:4px;background:linear-gradient(90deg,#f59e0b,#ef4444);"></div>
            <div style="padding:28px 24px;">

              <div style="background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:10px 16px;display:inline-block;margin-bottom:20px;">
                <span style="color:#f59e0b;font-weight:700;font-size:14px;">⚠️ PARTIDO APLAZADO</span>
              </div>

              <p style="color:#8888a8;font-size:14px;margin:0 0 20px;">
                El siguiente partido ha sido <strong style="color:#f59e0b;">aplazado</strong> por el equipo local.
              </p>

              <div style="background:#1c1c28;border-radius:14px;padding:20px;margin-bottom:20px;text-align:center;">
                <p style="margin:0;font-size:22px;font-weight:800;color:#f0f0f5;">${homeTeam}</p>
                <p style="margin:8px 0;font-size:16px;color:#8888a8;font-weight:700;">vs</p>
                <p style="margin:0;font-size:22px;font-weight:800;color:#f0f0f5;">${awayTeam}</p>
              </div>

              ${postponeType === 'reschedule' && newDateStr ? `
              <div style="display:flex;align-items:center;gap:12px;background:#1c1c28;border-radius:10px;padding:14px;margin-bottom:20px;">
                <span style="font-size:20px;">📅</span>
                <div>
                  <p style="margin:0;font-size:11px;color:#8888a8;text-transform:uppercase;letter-spacing:0.06em;font-weight:700;">Nueva fecha</p>
                  <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#00e5a0;">${newDateStr}</p>
                </div>
              </div>
              ` : `
              <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:14px;margin-bottom:20px;">
                <p style="margin:0;font-size:13px;color:#f59e0b;">📋 Pendiente de nueva fecha — el equipo local os contactará para acordar una nueva fecha.</p>
              </div>
              `}

              <div style="margin-top:24px;text-align:center;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://padelfriends.vercel.app'}/dashboard/schedule"
                   style="display:inline-block;background:#00e5a0;color:#000;font-weight:800;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;">
                  Ver agenda →
                </a>
              </div>
            </div>
          </div>

          <p style="text-align:center;color:#8888a8;font-size:12px;margin-top:24px;">Padel Friends · Gestión de campeonatos 🎾</p>
        </div>
      </body>
      </html>
    `;

    // Enviar a todos los jugadores del equipo rival
    const results = await Promise.all(emails.map(async (email: string) => {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Padel Friends <onboarding@resend.dev>',
          to: email,
          subject,
          html,
        }),
      });
      return res.ok;
    }));

    return NextResponse.json({ ok: true, sent: results.filter(Boolean).length });

  } catch (error) {
    console.error('notify-postpone error:', error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

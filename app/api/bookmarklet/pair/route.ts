import { NextRequest, NextResponse } from 'next/server';
import { exchangePairingCode } from '@/services/settings/extensionAuthSettings';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pairingCode = typeof body?.pairingCode === 'string' ? body.pairingCode : '';
    const exchanged = exchangePairingCode(pairingCode);
    return NextResponse.json({ success: true, token: exchanged.token });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pairing failed';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

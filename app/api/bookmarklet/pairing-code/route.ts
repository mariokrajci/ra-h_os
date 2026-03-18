import { NextRequest, NextResponse } from 'next/server';
import {
  generatePairingCode,
  getExtensionAuthStatus,
  revokeExtensionToken,
} from '@/services/settings/extensionAuthSettings';

export async function GET() {
  try {
    const status = getExtensionAuthStatus();
    return NextResponse.json({ success: true, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load extension auth status';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = typeof body?.action === 'string' ? body.action : 'generate';

    if (action === 'revoke') {
      revokeExtensionToken();
      return NextResponse.json({ success: true, revoked: true });
    }

    const pairing = generatePairingCode();
    return NextResponse.json({ success: true, pairing });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create pairing code';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

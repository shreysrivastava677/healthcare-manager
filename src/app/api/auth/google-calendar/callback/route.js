import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOAuth2Client } from '@/lib/calendar';
import prisma from '@/lib/prisma';

// GET /api/auth/google-calendar/callback - Handle Google OAuth callback
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      const role = session.user.role.toLowerCase();
      return NextResponse.redirect(new URL(`/${role}?calendar=error`, request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/?calendar=no-code', request.url));
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    // Store tokens for the user
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    });

    const role = session.user.role.toLowerCase();
    return NextResponse.redirect(new URL(`/${role}?calendar=connected`, request.url));
  } catch (error) {
    console.error('Google Calendar callback error:', error);
    return NextResponse.redirect(new URL('/?calendar=error', request.url));
  }
}

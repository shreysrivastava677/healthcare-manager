import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = request.nextUrl;

  // Public routes - allow access
  const publicRoutes = ['/', '/login', '/register', '/api/auth'];
  if (publicRoutes.some(route => pathname === route || pathname.startsWith('/api/auth'))) {
    // Redirect authenticated users away from auth pages
    if (token && (pathname === '/login' || pathname === '/register')) {
      const role = token.role?.toLowerCase() || 'patient';
      return NextResponse.redirect(new URL(`/${role}`, request.url));
    }
    return NextResponse.next();
  }

  // Check authentication
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = token.role;

  // Role-based route protection
  if (pathname.startsWith('/patient') && role !== 'PATIENT') {
    return NextResponse.redirect(new URL(`/${role.toLowerCase()}`, request.url));
  }
  if (pathname.startsWith('/doctor') && role !== 'DOCTOR') {
    return NextResponse.redirect(new URL(`/${role.toLowerCase()}`, request.url));
  }
  if (pathname.startsWith('/admin') && role !== 'ADMIN') {
    return NextResponse.redirect(new URL(`/${role.toLowerCase()}`, request.url));
  }

  // API route protection
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth')) {
    // Allow authenticated users to access API routes
    // Individual routes handle their own role checks
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images|api/cron).*)',
  ],
};

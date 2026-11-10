import { NextResponse } from 'next/server'; // 👈 Must be next/server, not next/navigation
import { auth } from '@/auth';

export const runtime = 'nodejs';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isDashboardRoute = req.nextUrl.pathname.startsWith('/dashboard');

  if (isDashboardRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/dashboard/:path*'],
};
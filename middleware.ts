import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Add pathname to headers for layout access check
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  // Only check dashboard routes
  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  const token = await getToken({ req: request });

  // If not authenticated, redirect to home
  if (!token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/dashboard/:path*"],
};

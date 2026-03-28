import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that never require authentication
const PUBLIC_ROUTES = new Set(["/login"]);

// API routes that are always public (auth endpoints + health check)
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/health"];
const PUBLIC_INTERNAL_PREFIXES = [
  "/_next/static",
  "/_next/image",
  "/_next/webpack-hmr",
  "/_next/data",
  "/__nextjs_font",
  "/__nextjs_original-stack-frame",
  "/__nextjs_source-map",
];

function isAuthenticated(request: NextRequest): boolean {
  const authCookie = request.cookies.get("mc_auth");
  return !!(authCookie && authCookie.value === process.env.AUTH_SECRET);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";

  // In local dev, canonicalize the noisy 127.0.0.1 origin to localhost so the
  // browser keeps all subsequent dev client requests on the same host.
  if (
    process.env.NODE_ENV !== "production" &&
    (request.nextUrl.hostname === "127.0.0.1" || host.startsWith("127.0.0.1:")) &&
    !pathname.startsWith("/_next/") &&
    !pathname.startsWith("/api/")
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.hostname = "localhost";
    return NextResponse.redirect(redirectUrl);
  }

  // Always allow public pages (login)
  if (PUBLIC_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  // Always allow public API routes (auth + health)
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (PUBLIC_INTERNAL_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Check authentication
  if (!isAuthenticated(request)) {
    // For API routes: return 401 JSON (not a redirect)
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    // For page routes: redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - _next/webpack-hmr (dev websocket)
     * - __nextjs_font / stack frame internals
     * - favicon.ico (favicon file)
     * - public files (with extension)
     */
    "/((?!_next/static|_next/image|_next/webpack-hmr|__nextjs_font|__nextjs_original-stack-frame|__nextjs_source-map|favicon.ico|.*\\..*).*)"],
};

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { CHILD_COOKIE } from "@/lib/access";

type PendingCookie = { name: string; value: string; options: CookieOptions };

function redirectWithCookies(
  request: NextRequest,
  pathname: string,
  pending: PendingCookie[],
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const response = NextResponse.redirect(url);
  for (const cookie of pending) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}

function jsonWithCookies(body: { error: string }, status: number, pending: PendingCookie[]) {
  const response = NextResponse.json(body, { status });
  for (const cookie of pending) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}

// Stuurt een bezoeker zonder login naar het inlogscherm.
// Een ouder zonder gekozen kind gaat naar "Wie gaat er lezen?".
// De cookie met het kind-id is hier nog geen bewijs: elke pagina en API-route
// controleert daarna in de database of dat kind bij deze ouder hoort.
export async function updateSession(request: NextRequest) {
  const pending: PendingCookie[] = [];
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return supabaseResponse;

  const supabase = createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        pending.splice(0, pending.length, ...cookiesToSet);
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLogin = path === "/inloggen";
  const isWho = path === "/wie";
  const isApi = path.startsWith("/api/");

  if (!user) {
    if (isLogin) return supabaseResponse;
    if (isApi) return jsonWithCookies({ error: "Log eerst in." }, 401, pending);
    return redirectWithCookies(request, "/inloggen", pending);
  }

  if (isLogin) return redirectWithCookies(request, "/wie", pending);

  const childId = request.cookies.get(CHILD_COOKIE)?.value;
  if (!childId && !isWho) {
    if (isApi) return jsonWithCookies({ error: "Kies eerst wie er leest." }, 403, pending);
    return redirectWithCookies(request, "/wie", pending);
  }

  return supabaseResponse;
}

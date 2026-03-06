import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/', '/login', '/register', '/submission-status']
const ADMIN_ROUTES = ['/dashboard', '/director', '/csu', '/planning', '/monitoring', '/finance']

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const { pathname } = req.nextUrl

  // Skip middleware for public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return res
  }

  // Create Supabase client
  const supabase = createMiddlewareClient({ req, res })

  // Check auth for admin routes
  if (ADMIN_ROUTES.some(route => pathname.startsWith(route))) {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/login'
      return NextResponse.redirect(redirectUrl)
    }

    // Get user role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, active')
      .eq('id', session.user.id)
      .single()

    if (!profile?.active) {
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/login?error=Account inactive'
      return NextResponse.redirect(redirectUrl)
    }

    // Check role access
    const rolePrefix = `/${profile.role}`
    if (!pathname.startsWith(rolePrefix)) {
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = `${rolePrefix}/dashboard`
      return NextResponse.redirect(redirectUrl)
    }
  }

  return res
}
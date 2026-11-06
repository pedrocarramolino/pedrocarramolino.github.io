import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { serverSupabase } from '@/lib/supabase/server';

/** Verifica enlaces de confirmación / recuperación con token_hash. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const nextParam = searchParams.get('next');
  const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';
  if (token_hash && type) {
    const sb = await serverSupabase();
    const { error } = await sb.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}${type === 'recovery' ? '/ajustes?seccion=cuenta&recuperar=1' : next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=enlace`);
}

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://ibnvwdcrxpxcquzvveue.supabase.co',
  'sb_publishable_5yJrrpfjymf4ZzFv9BXx5Q_05uwKbkR',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Anonim oturum: tüm uygulama tek bir oturum açma isteğini paylaşır
// (aynı anda iki istek gidip iki ayrı anonim kullanıcı oluşmasın diye).
let sessionPromise: Promise<boolean> | null = null;
export function ensureSession(): Promise<boolean> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) return true;
      const { error } = await supabase.auth.signInAnonymously();
      return !error;
    })().then((ok) => {
      if (!ok) sessionPromise = null;
      return ok;
    });
  }
  return sessionPromise;
}

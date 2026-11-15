// 1.5.6: Sunucu bayrakları (get_app_flags). Oturumda bir kez okunur, son değer telefonda saklanır.
// result_push: 21:00 sonuç bildirimini sunucu gönderiyorsa true; o zaman telefon kendi bildirimini kurmaz.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ensureSession, supabase } from '@/lib/supabase';

const KEY = 'server_flags_v1';
type Flags = { result_push?: boolean };

let cached: Flags | null = null;
let loading: Promise<Flags> | null = null;

async function load(): Promise<Flags> {
  let saved: Flags = {};
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) saved = JSON.parse(raw) ?? {};
  } catch {}
  try {
    if (await ensureSession()) {
      const { data, error } = await supabase.rpc('get_app_flags');
      if (!error && data && typeof data === 'object') {
        const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
        if (row) {
          saved = { result_push: row.result_push === true };
          AsyncStorage.setItem(KEY, JSON.stringify(saved)).catch(() => {});
        }
      }
    }
  } catch {}
  return saved;
}

export async function serverFlags(): Promise<Flags> {
  if (cached) return cached;
  if (!loading) loading = load().then((f) => (cached = f));
  return loading;
}

export async function serverResultPushOn(): Promise<boolean> {
  try {
    return (await serverFlags()).result_push === true;
  } catch {
    return false;
  }
}

// 1.6.0: Mağaza puanı isteği. En az 3 farklı gün gelmiş kişiye, Günün Sorusu sonucunu gördükten sonra
// (iyi bir anda), kişi başına bir kez; kapatırsa en erken 60 gün sonra tekrar.
// Pencereyi Apple/Google'ın kendi puan penceresi açar; gösterip göstermemeye de onlar karar verir (yılda birkaç kez).
// Önce "memnun musun?" diye sorup yalnızca memnunları yönlendirmek mağaza kurallarına aykırı; yapılmaz.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

import { isOverlayBusy } from '@/lib/overlay';

const ASKED_KEY = 'review_asked_v1'; // son istenme zamanı (ms)
const HISTORY_KEY = 'moment_history_v1';
const ANSWERS_KEY = 'dq_answers_v1';
const MIN_DAYS = 3;
const AGAIN_MS = 60 * 24 * 60 * 60 * 1000;

async function activeDays(): Promise<number> {
  const days = new Set<string>();
  try {
    const h = JSON.parse((await AsyncStorage.getItem(HISTORY_KEY)) || '[]');
    for (const e of Array.isArray(h) ? h : []) {
      if (e && typeof e.at === 'number') {
        const d = new Date(e.at);
        days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
      }
    }
  } catch {}
  let answered = 0;
  try {
    answered = Object.keys(JSON.parse((await AsyncStorage.getItem(ANSWERS_KEY)) || '{}')).length;
  } catch {}
  return Math.max(days.size, answered);
}

export function maybeAskReview(delayMs = 1500): void {
  setTimeout(async () => {
    try {
      if (isOverlayBusy()) return;
      const last = Number(await AsyncStorage.getItem(ASKED_KEY)) || 0;
      if (last && Date.now() - last < AGAIN_MS) return;
      if ((await activeDays()) < MIN_DAYS) return;
      if (!(await StoreReview.isAvailableAsync())) return;
      await AsyncStorage.setItem(ASKED_KEY, String(Date.now()));
      await StoreReview.requestReview();
    } catch {}
  }, delayMs);
}

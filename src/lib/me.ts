// "Ben" sekmesinin verileri: görünen ad, meslek, üniversite ve arkadaş ayarları.
// 1.2 sürümünde bu bilgilerin HİÇBİRİ sunucuya gitmez; sadece telefonda (AsyncStorage) tutulur.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Lang } from '@/lib/i18n';

export const ME_KEY = 'me_v1';

// Arkadaşlar sekmesi geliştirme anahtarının arkasında: Expo Go'da (geliştirme) açık,
// mağaza build'inde kapalı. Apple 1.2 uyum listesi tamamlanmadan true yapılmayacak.
export const FRIENDS_TAB_ENABLED = true;

export type Me = {
  displayName?: string;
  occupation?: string; // OCCUPATIONS içindeki id
  university?: string; // Üniversitenin adı ya da UNIVERSITY_OTHER
  moodShare?: boolean; // Ruh hallerimi arkadaşlarım görsün (varsayılan kapalı)
};

export async function loadMe(): Promise<Me> {
  try {
    const raw = await AsyncStorage.getItem(ME_KEY);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export async function saveMe(me: Me): Promise<void> {
  try {
    await AsyncStorage.setItem(ME_KEY, JSON.stringify(me));
  } catch {}
}

// ---- Meslek ----
export const STUDENT = 'student';

export const OCCUPATIONS: { id: string; tr: string; en: string }[] = [
  { id: 'student', tr: 'Öğrenci', en: 'Student' },
  { id: 'teacher', tr: 'Öğretmen', en: 'Teacher' },
  { id: 'health', tr: 'Sağlık çalışanı', en: 'Healthcare worker' },
  { id: 'tech', tr: 'Yazılım ve teknoloji', en: 'Software & tech' },
  { id: 'engineer', tr: 'Mühendis', en: 'Engineer' },
  { id: 'office', tr: 'Ofis çalışanı', en: 'Office worker' },
  { id: 'public', tr: 'Kamu çalışanı', en: 'Public sector' },
  { id: 'trade', tr: 'Esnaf ve ticaret', en: 'Trade & retail' },
  { id: 'freelance', tr: 'Serbest çalışan', en: 'Freelancer' },
  { id: 'home', tr: 'Evde', en: 'At home' },
  { id: 'retired', tr: 'Emekli', en: 'Retired' },
  { id: 'other', tr: 'Diğer', en: 'Other' },
];

export function occupationLabel(id: string | undefined, lang: Lang): string {
  if (!id) return '';
  const o = OCCUPATIONS.find((x) => x.id === id);
  return o ? o[lang] : '';
}

// ---- Görünen ad ----
export const NAME_MIN = 2;
export const NAME_MAX = 15;

export type NameCheck = 'ok' | 'short' | 'long' | 'chars' | 'bad';

// Fazla boşlukları temizler
export function cleanDisplayName(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

// Emojiler tek karakter sayılsın diye kod noktası olarak sayıyoruz
export function nameLength(s: string): number {
  return Array.from(s).length;
}

// İzin verilen: harf (her dilde), rakam, boşluk ve emoji.
// Engellenen: noktalama ve sembol karakterleri (!, @, #, . , _ vb.) ve kontrol karakterleri.
const BLOCKED_CHARS = /[\u0000-\u001F\u007F!-\/:-@\[-`{-~¡-¿×÷]/;

export function checkDisplayName(raw: string): NameCheck {
  const name = cleanDisplayName(raw);
  const len = nameLength(name);
  if (len < NAME_MIN) return 'short';
  if (len > NAME_MAX) return 'long';
  if (BLOCKED_CHARS.test(name)) return 'chars';
  if (isOffensive(name)) return 'bad';
  return 'ok';
}

export function nameError(c: NameCheck, lang: Lang): string {
  const tr = lang === 'tr';
  switch (c) {
    case 'short':
      return tr ? `En az ${NAME_MIN} karakter olmalı` : `At least ${NAME_MIN} characters`;
    case 'long':
      return tr ? `En fazla ${NAME_MAX} karakter olabilir` : `Up to ${NAME_MAX} characters`;
    case 'chars':
      return tr ? 'Sadece harf, rakam, boşluk ve emoji kullanabilirsin' : 'Use only letters, numbers, spaces and emoji';
    case 'bad':
      return tr ? 'Bu ad uygun görünmüyor, başka bir ad dener misin?' : "This name doesn't look right, could you try another?";
    default:
      return '';
  }
}

// ---- Basit küfür ve hakaret filtresi ----
// Karşılaştırma "katlanmış" metin üzerinde yapılır: küçük harf, Türkçe harfler sadeleşir (ş→s, ı→i...),
// rakamla yazılan harfler çözülür (4→a, 3→e...) ve tekrar eden harfler teke iner (siiiik → sik).
function fold(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıîì]/g, 'i')
    .replace(/[ğ]/g, 'g')
    .replace(/[üûù]/g, 'u')
    .replace(/[ş]/g, 's')
    .replace(/[öô]/g, 'o')
    .replace(/[ç]/g, 'c')
    .replace(/[âà]/g, 'a')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/(.)\1+/g, '$1');
}

// Metnin herhangi bir yerinde geçmesi yeterli olanlar (başka masum kelimelerin içinde geçmeyecek kadar belirgin)
const BAD_ANYWHERE = [
  'orospu', 'siktir', 'sikerim', 'sikeyim', 'sikis', 'yarak', 'aminako', 'amcik', 'pezevenk', 'gotveren',
  'kahpe', 'kaltak', 'surtuk', 'yavsak', 'serefsiz', 'fuck', 'niger', 'nigga', 'fagot', 'motherf', 'whore',
];

// Sadece tek başına bir kelime olarak geçtiğinde engellenenler (isimlerin içinde geçebilecek kısa kelimeler)
const BAD_WORDS = [
  'amk', 'aq', 'mk', 'oc', 'pic', 'sik', 'sikik', 'got', 'ibne', 'gavat', 'pust', 'dalyarak',
  'dick', 'shit', 'bitch', 'slut', 'cunt', 'ass', 'ashole', 'bastard', 'pusy', 'dildo', 'penis', 'porn', 'sex', 'seks',
];

export function isOffensive(name: string): boolean {
  const f = fold(name);
  const compact = f.replace(/\s+/g, '');
  if (BAD_ANYWHERE.some((w) => compact.includes(w))) return true;
  const words = f.split(/\s+/).filter(Boolean);
  return words.some((w) => BAD_WORDS.includes(w)) || BAD_WORDS.includes(compact);
}

// Görünen adın ilk karakteri (avatar için)
export function nameInitial(name: string | undefined): string {
  if (!name) return '';
  const first = Array.from(cleanDisplayName(name))[0] ?? '';
  return first.toLocaleUpperCase('tr-TR');
}

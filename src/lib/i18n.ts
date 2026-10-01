import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

export type Lang = 'tr' | 'en';
export const LANG_KEY = 'lang';

// Telefonun dili Türkçe ise Türkçe, değilse İngilizce
export function deviceLang(): Lang {
  try {
    const code = Localization.getLocales()[0]?.languageCode ?? '';
    return code === 'tr' ? 'tr' : 'en';
  } catch {
    return 'tr';
  }
}

export async function loadLang(): Promise<Lang> {
  try {
    const v = await AsyncStorage.getItem(LANG_KEY);
    if (v === 'tr' || v === 'en') return v;
  } catch {}
  return deviceLang();
}

export async function saveLang(lang: Lang): Promise<void> {
  try {
    await AsyncStorage.setItem(LANG_KEY, lang);
  } catch {}
}

// ---- Aktivite adları (veritabanında id'ler saklanır, ad sadece görüntü içindir) ----
const ACTIVITY_NAMES: Record<string, { tr: string; en: string }> = {
  lying: { tr: 'Uzanıyorum', en: 'Lying down' },
  work: { tr: 'İşteyim', en: 'At work' },
  eat: { tr: 'Yemek yiyorum', en: 'Eating' },
  cook: { tr: 'Yemek yapıyorum', en: 'Cooking' },
  travel: { tr: 'Yoldayım', en: 'On the road' },
  study: { tr: 'Ders çalışıyorum', en: 'Studying' },
  sport: { tr: 'Spor yapıyorum', en: 'Working out' },
  tv: { tr: 'Dizi/film izliyorum', en: 'Watching a show' },
  coffee: { tr: 'Kahve içiyorum', en: 'Having coffee' },
  gaming: { tr: 'Oyun oynuyorum', en: 'Gaming' },
  shop: { tr: 'Alışveriş yapıyorum', en: 'Shopping' },
  chores: { tr: 'Ev işi yapıyorum', en: 'Doing chores' },
  friends: { tr: 'Arkadaşlarımla birlikteyim', en: 'With friends' },
  scrolling: { tr: 'Telefonda geziniyorum', en: 'On my phone' },
  resting: { tr: 'Dinleniyorum', en: 'Resting' },
  happy: { tr: 'Neşeliyim', en: 'Happy' },
  calm: { tr: 'Huzurluyum', en: 'At peace' },
  hurt: { tr: 'Kırgınım', en: 'Hurt' },
  angry: { tr: 'Öfkeliyim', en: 'Angry' },
  bored: { tr: 'Sıkılıyorum', en: 'Bored' },
  procrastinating: { tr: 'Erteliyorum', en: 'Procrastinating' },
  nothing: { tr: 'Boş boş oturuyorum', en: 'Just sitting around' },
  money: { tr: 'Borçları düşünüyorum', en: 'Worrying about debts' },
  sick: { tr: 'Hastayım', en: "I'm sick" },
};

export function activityName(id: string, lang: Lang): string {
  return ACTIVITY_NAMES[id]?.[lang] ?? id;
}

// ---- Ülkeler (değer Türkçe ad olarak saklanır, dile göre gösterilir) ----
export const COUNTRY_TR = 'Türkiye';
export const COUNTRY_OTHER = 'Diğer';

const COUNTRY_LIST: { value: string; en: string; code: string }[] = [
  { value: 'Türkiye', en: 'Türkiye', code: 'TR' },
  { value: 'Almanya', en: 'Germany', code: 'DE' },
  { value: 'Amerika Birleşik Devletleri', en: 'United States', code: 'US' },
  { value: 'Arjantin', en: 'Argentina', code: 'AR' },
  { value: 'Avustralya', en: 'Australia', code: 'AU' },
  { value: 'Avusturya', en: 'Austria', code: 'AT' },
  { value: 'Azerbaycan', en: 'Azerbaijan', code: 'AZ' },
  { value: 'Belçika', en: 'Belgium', code: 'BE' },
  { value: 'Birleşik Arap Emirlikleri', en: 'United Arab Emirates', code: 'AE' },
  { value: 'Birleşik Krallık', en: 'United Kingdom', code: 'GB' },
  { value: 'Brezilya', en: 'Brazil', code: 'BR' },
  { value: 'Bulgaristan', en: 'Bulgaria', code: 'BG' },
  { value: 'Çin', en: 'China', code: 'CN' },
  { value: 'Danimarka', en: 'Denmark', code: 'DK' },
  { value: 'Endonezya', en: 'Indonesia', code: 'ID' },
  { value: 'Fransa', en: 'France', code: 'FR' },
  { value: 'Güney Kore', en: 'South Korea', code: 'KR' },
  { value: 'Gürcistan', en: 'Georgia', code: 'GE' },
  { value: 'Hindistan', en: 'India', code: 'IN' },
  { value: 'Hollanda', en: 'Netherlands', code: 'NL' },
  { value: 'Irak', en: 'Iraq', code: 'IQ' },
  { value: 'İran', en: 'Iran', code: 'IR' },
  { value: 'İspanya', en: 'Spain', code: 'ES' },
  { value: 'İsveç', en: 'Sweden', code: 'SE' },
  { value: 'İsviçre', en: 'Switzerland', code: 'CH' },
  { value: 'İtalya', en: 'Italy', code: 'IT' },
  { value: 'Japonya', en: 'Japan', code: 'JP' },
  { value: 'Kanada', en: 'Canada', code: 'CA' },
  { value: 'Katar', en: 'Qatar', code: 'QA' },
  { value: 'Kazakistan', en: 'Kazakhstan', code: 'KZ' },
  { value: 'Kuzey Kıbrıs', en: 'Northern Cyprus', code: 'CY' },
  { value: 'Meksika', en: 'Mexico', code: 'MX' },
  { value: 'Mısır', en: 'Egypt', code: 'EG' },
  { value: 'Norveç', en: 'Norway', code: 'NO' },
  { value: 'Özbekistan', en: 'Uzbekistan', code: 'UZ' },
  { value: 'Pakistan', en: 'Pakistan', code: 'PK' },
  { value: 'Polonya', en: 'Poland', code: 'PL' },
  { value: 'Romanya', en: 'Romania', code: 'RO' },
  { value: 'Rusya', en: 'Russia', code: 'RU' },
  { value: 'Suudi Arabistan', en: 'Saudi Arabia', code: 'SA' },
  { value: 'Ukrayna', en: 'Ukraine', code: 'UA' },
  { value: 'Yunanistan', en: 'Greece', code: 'GR' },
];

export function countryLabel(value: string | null | undefined, lang: Lang): string {
  if (!value) return '';
  if (value === COUNTRY_OTHER) return lang === 'tr' ? 'Diğer' : 'Other';
  const c = COUNTRY_LIST.find((x) => x.value === value);
  if (!c) return value;
  return lang === 'tr' ? c.value : c.en;
}

// Seçim listesi: Türkiye başta, diğerleri seçilen dile göre alfabetik, en sonda "Diğer"
export function countryOptions(lang: Lang): { value: string; label: string }[] {
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const rest = COUNTRY_LIST.filter((c) => c.value !== COUNTRY_TR)
    .map((c) => ({ value: c.value, label: lang === 'tr' ? c.value : c.en }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
  return [
    { value: COUNTRY_TR, label: countryLabel(COUNTRY_TR, lang) },
    ...rest,
    { value: COUNTRY_OTHER, label: countryLabel(COUNTRY_OTHER, lang) },
  ];
}

export function countryFromRegion(region: string): string {
  return COUNTRY_LIST.find((c) => c.code === region)?.value ?? COUNTRY_OTHER;
}

// ---- Cinsiyet (değer Türkçe saklanır; veritabanı kuralı bu değerleri bekliyor) ----
export const GENDER_VALUES = ['Kadın', 'Erkek', 'Belirtmek istemiyorum'];
export const GENDER_NO_ANSWER = 'Belirtmek istemiyorum';
const GENDER_EN: Record<string, string> = {
  Kadın: 'Woman',
  Erkek: 'Man',
  'Belirtmek istemiyorum': 'Prefer not to say',
};

export function genderLabel(value: string | null | undefined, lang: Lang): string {
  if (!value) return '';
  return lang === 'tr' ? value : GENDER_EN[value] ?? value;
}

// ---- Biçimlendirme ----
export function formatPct(p: number, lang: Lang): string {
  return lang === 'tr' ? '%' + p.toFixed(1).replace('.', ',') : p.toFixed(1) + '%';
}

export function formatCount(n: number, lang: Lang): string {
  return n.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US');
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

// Türkçe saat eki: 11:30'da, 13:50'de, 16:45'te
function timeSuffix(h: number, m: number) {
  const n = m === 0 ? h : m;
  const ones: Record<number, string> = { 1: 'de', 2: 'de', 3: 'te', 4: 'te', 5: 'te', 6: 'da', 7: 'de', 8: 'de', 9: 'da' };
  const tens: Record<number, string> = { 0: 'da', 10: 'da', 20: 'de', 30: 'da', 40: 'ta', 50: 'de' };
  return n % 10 !== 0 ? ones[n % 10] : tens[n % 60] ?? 'de';
}

export function momentLabel(m: { start: Date; isOpen: boolean }, lang: Lang): string {
  if (m.isOpen) return lang === 'tr' ? 'Günün Anı şu an, cevapla' : "Today's Moment is now, answer";
  if (Date.now() < m.start.getTime()) {
    const h = m.start.getHours();
    const min = m.start.getMinutes();
    return lang === 'tr'
      ? `Bugünün anı ${pad2(h)}:${pad2(min)}'${timeSuffix(h, min)}`
      : `Today's Moment at ${pad2(h)}:${pad2(min)}`;
  }
  return lang === 'tr' ? 'Bugünün anı geçti, yarın yeni an' : "Today's Moment has passed, new one tomorrow";
}

const DAY_NAMES = {
  tr: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

export type DayPartIcon = 'sunny-outline' | 'sunny' | 'partly-sunny-outline' | 'moon-outline';

// "Cuma öğleden sonrası" / "Friday afternoon" gibi gün dilimi ve ona uygun ikon
export function dayPart(lang: Lang): { text: string; icon: DayPartIcon; color: string } {
  const d = new Date();
  const h = d.getHours();
  const day = DAY_NAMES[lang][d.getDay()];
  if (h >= 6 && h < 12)
    return { text: lang === 'tr' ? `${day} sabahı` : `${day} morning`, icon: 'sunny-outline', color: '#FBBF24' };
  if (h >= 12 && h < 17)
    return { text: lang === 'tr' ? `${day} öğleden sonrası` : `${day} afternoon`, icon: 'sunny', color: '#FBBF24' };
  if (h >= 17 && h < 21)
    return { text: lang === 'tr' ? `${day} akşamı` : `${day} evening`, icon: 'partly-sunny-outline', color: '#FDBA74' };
  return { text: lang === 'tr' ? `${day} gecesi` : `${day} night`, icon: 'moon-outline', color: '#A5B4FC' };
}

// Sonuç kartındaki açıklama cümlesi
export function ratioLine(filter: string, value: string | null | undefined, lang: Lang): string {
  if (lang === 'tr') {
    switch (filter) {
      case 'country':
        return `Şu an ülkende (${countryLabel(value, lang)}) seninle aynı şeyi yapanların oranı`;
      case 'age':
        return `Şu an ${value} yaş aralığında seninle aynı şeyi yapanların oranı`;
      case 'city':
        return `Şu an ${value} ilinde seninle aynı şeyi yapanların oranı`;
      case 'gender':
        if (value === GENDER_NO_ANSWER)
          return 'Şu an cinsiyetini belirtmemeyi tercih edenler arasında seninle aynı şeyi yapanların oranı';
        return `Şu an ${value?.toLocaleLowerCase('tr-TR')} kullanıcılar arasında seninle aynı şeyi yapanların oranı`;
      default:
        return 'Şu an dünyada seninle aynı şeyi yapanların oranı';
    }
  }
  switch (filter) {
    case 'country':
      return `Share of people in ${countryLabel(value, lang)} doing the same as you right now`;
    case 'age':
      return `Share of people aged ${value} doing the same as you right now`;
    case 'city':
      return `Share of people in ${value} doing the same as you right now`;
    case 'gender':
      if (value === GENDER_NO_ANSWER)
        return 'Share of people who prefer not to share their gender doing the same as you right now';
      return value === 'Kadın'
        ? 'Share of women doing the same as you right now'
        : 'Share of men doing the same as you right now';
    default:
      return 'Share of people worldwide doing the same as you right now';
  }
}

// ---- Arayüz metinleri ----
export const STRINGS = {
  tr: {
    appName: 'Şu An: Kim Ne Yapıyor?',
    splashQuestion: 'Şu an dünyada\nkim ne yapıyor?',
    splashHint: 'Merak ediyorsan hemen öğren',
    heroBefore: 'Şu an ',
    heroAccent: 'sen',
    heroAfter: '\nne yapıyorsun?',
    heroCount: (n: string) => `Şu an ${n} kişi burada`,
    dashEntry: (n: string) => `🌍 Şu an ${n} kişi aktif · Canlı panoyu gör`,
    sectionTop: 'Bu saatte en olası aktiviteler',
    sectionOthers: 'Diğer aktiviteler',
    sectionMood: 'Ruh halim',
    resetLink: 'Kayıtlı bilgilerimi sıfırla',
    privacyLink: 'Gizlilik politikası',
    filters: { world: 'Dünya', country: 'Ülke', city: 'Şehir', age: 'Yaş', gender: 'Cinsiyet' },
    pickCountry: 'Hangi ülkede yaşıyorsun?',
    searchCountry: 'Ülke ara',
    pickCity: 'Hangi ilde yaşıyorsun?',
    searchCity: 'İl ara',
    pickAge: 'Yaş aralığını seç',
    pickGender: 'Cinsiyetini seç',
    change: 'Değiştir',
    consentTitle: 'Karşılaştırma için bilgi paylaşımı',
    consentP1:
      'Ülke, yaş aralığı, şehir ve cinsiyet bilgilerin, seçtiğin aktivite ile birlikte anonim olarak sunucuya gönderilir. Adın, e-postan ya da telefon numaran istenmez.',
    consentP2:
      'Bilgilerin yalnızca oranları hesaplamak için kullanılır ve aktivitenin geçerli olduğu 60 dakika boyunca hesaba katılır. İstediğin zaman ana ekrandan silebilirsin.',
    readPrivacy: 'Gizlilik politikasını oku',
    accept: 'Kabul ediyorum',
    notNow: 'Şimdi değil',
    live: 'Canlı',
    amongUsers: 'Uygulamayı kullananlar arasında',
    noData: 'Henüz veri yok',
    firstTitle: 'İlk gelenlerdensin',
    firstNote: 'Birkaç kişi daha bu aktiviteyi seçtiğinde oran netleşecek ve burada otomatik olarak belirecek.',
    errorBadge: 'Bağlantı yok',
    errorTitle: 'Bağlantı kurulamadı',
    errorNote: 'İnternet bağlantını kontrol edip tekrar dene.',
    retry: 'Tekrar dene',
    validFor: (m: number) => `Aktiviten ${m} dk daha geçerli`,
    sixtyMin: '60 dk',
    shareActivity: 'Aktiviteni arkadaşınla paylaş',
    changeActivity: 'Aktivitemi değiştir',
    shareMessage: (what: string, app: string, url: string) =>
      `Şu an ${what}. Sen ne yapıyorsun? Senin gibi kaç kişi var, ${app} uygulamasında bak: ${url}`,
    shareDialog: 'Sonucunu paylaş',
    shareUnavailableTitle: 'Paylaşım kullanılamıyor',
    shareUnavailableText: 'Bu cihazda paylaşım penceresi açılamadı.',
    shareErrorTitle: 'Bir sorun oluştu',
    shareErrorText: 'Görsel oluşturulamadı, tekrar dener misin?',
    shareTry: 'Sen de dene',
    storyHintTitle: 'Bir ipucu 🔗',
    storyHintText: 'Hikâyene bağlantı çıkartması ekle, görenler Şu An\'ı hemen bulsun.',
    ok: 'Tamam',
    resetTitle: 'Bilgilerin silinsin mi?',
    resetText: 'Ülke, yaş, şehir ve cinsiyet seçimlerin ile sunucudaki aktif kaydın silinir.',
    cancel: 'Vazgeç',
    delete: 'Sil',
    notifTitle: 'Herkes aynı anda cevaplasa?',
    notifText: 'Her gün bir an seçiyoruz ve herkese aynı soruyu soruyoruz: Şu an ne yapıyorsun?',
    notifSub: 'Günde tek bildirim, fazlası yok.',
    notifYes: 'Ben de varım',
    dashTitle: 'Canlı Pano',
    dashActive: 'ŞU AN AKTİF',
    dashSub: 'kişi uygulamada bir aktivite seçmiş durumda',
    dashSection: 'Şu an en çok ne yapılıyor?',
    dashEmpty: 'Şu an yeterli veri toplanan aktivite yok.',
  },
  en: {
    appName: "Şu An: Who's Doing What?",
    splashQuestion: "Who's doing what\nright now?",
    splashHint: 'Curious? Find out now',
    heroBefore: 'What are ',
    heroAccent: 'you',
    heroAfter: '\ndoing right now?',
    heroCount: (n: string) => `${n} people here right now`,
    dashEntry: (n: string) => `🌍 ${n} people active now · See the live board`,
    sectionTop: 'Most likely right now',
    sectionOthers: 'Other activities',
    sectionMood: 'My mood',
    resetLink: 'Reset my saved info',
    privacyLink: 'Privacy policy',
    filters: { world: 'World', country: 'Country', city: 'City', age: 'Age', gender: 'Gender' },
    pickCountry: 'Which country do you live in?',
    searchCountry: 'Search country',
    pickCity: 'Which city do you live in?',
    searchCity: 'Search city',
    pickAge: 'Choose your age range',
    pickGender: 'Choose your gender',
    change: 'Change',
    consentTitle: 'Sharing info for comparison',
    consentP1:
      'Your country, age range, city and gender are sent anonymously to our server together with the activity you picked. We never ask for your name, email or phone number.',
    consentP2:
      'This info is only used to calculate the percentages, and only for the 60 minutes your activity is active. You can delete it anytime from the home screen.',
    readPrivacy: 'Read the privacy policy',
    accept: 'I agree',
    notNow: 'Not now',
    live: 'Live',
    amongUsers: 'Among people using the app',
    noData: 'No data yet',
    firstTitle: "You're one of the first",
    firstNote: 'Once a few more people pick this activity, the percentage will appear here automatically.',
    errorBadge: 'Offline',
    errorTitle: "Couldn't connect",
    errorNote: 'Check your internet connection and try again.',
    retry: 'Try again',
    validFor: (m: number) => `Your activity stays active for ${m} more min`,
    sixtyMin: '60 min',
    shareActivity: 'Share your activity with a friend',
    changeActivity: 'Change my activity',
    shareMessage: (what: string, app: string, url: string) =>
      `Right now: ${what}. What are you doing? See how many people are just like you on ${app}: ${url}`,
    shareDialog: 'Share your result',
    shareUnavailableTitle: 'Sharing unavailable',
    shareUnavailableText: "The share sheet couldn't be opened on this device.",
    shareErrorTitle: 'Something went wrong',
    shareErrorText: "We couldn't create the image. Could you try again?",
    shareTry: 'Try it too',
    storyHintTitle: 'Quick tip 🔗',
    storyHintText: 'Add a link sticker to your story so others can find Şu An right away.',
    ok: 'Got it',
    resetTitle: 'Delete your info?',
    resetText: 'Your country, age, city and gender choices and your active record on the server will be deleted.',
    cancel: 'Cancel',
    delete: 'Delete',
    notifTitle: 'What if everyone answered at once?',
    notifText: 'Every day we pick one moment and ask everyone the same question: What are you doing right now?',
    notifSub: 'One notification a day, nothing more.',
    notifYes: "I'm in",
    dashTitle: 'Live Board',
    dashActive: 'ACTIVE NOW',
    dashSub: 'people have picked an activity in the app',
    dashSection: 'What are most people doing right now?',
    dashEmpty: 'No activity has enough data right now.',
  },
};

export type Strings = (typeof STRINGS)['tr'];

// Günün Anı bildirim metni
export const NOTIF_TEXT = {
  tr: { title: 'Günün Anı 👀', body: 'Şu an ne yapıyorsun? Herkes aynı anda cevaplıyor.' },
  en: { title: "Today's Moment 👀", body: 'What are you doing right now? Everyone is answering at once.' },
};

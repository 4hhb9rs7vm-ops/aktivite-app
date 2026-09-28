// Paylaşım kartı (Instagram hikâyesi) içerik matrisi ve kuralları.
// Kaynak: paylasim-matrisi-nihai.xlsx. Metinleri değiştirmek için sadece STORY_TEXTS'i düzenle.
import { countryLabel, COUNTRY_OTHER, GENDER_NO_ANSWER, Lang } from '@/lib/i18n';

export type Tier = 'crowd' | 'mid' | 'rare' | 'ultra' | 'none';

// Hikâye kartı renkleri: [açık, ana, koyu]
export const STORY_COLORS: Record<string, [string, string, string]> = {
  violet: ['#A78BFA', '#7C3AED', '#4C1D95'],
  indigo: ['#818CF8', '#4F46E5', '#312E81'],
  orange: ['#FB923C', '#EA580C', '#9A3412'],
  red: ['#F87171', '#DC2626', '#7F1D1D'],
  sky: ['#38BDF8', '#0284C7', '#0C4A6E'],
  emerald: ['#34D399', '#059669', '#064E3B'],
  teal: ['#2DD4BF', '#0E8A8A', '#134E4A'],
  rose: ['#FB7185', '#E11D48', '#881337'],
  coffee: ['#F59E0B', '#B45309', '#78350F'],
  fuchsia: ['#E879F9', '#C026D3', '#701A75'],
  pink: ['#F472B6', '#DB2777', '#831843'],
  cyan: ['#22D3EE', '#0891B2', '#164E63'],
  tangerine: ['#FDBA74', '#F97316', '#9A3412'],
  navy: ['#4F6FA8', '#1E3A6E', '#0F2A52'],
  green: ['#4ADE80', '#16A34A', '#14532D'],
  sunset: ['#FCA5A5', '#F43F5E', '#9F1239'],
  seafoam: ['#5EEAD4', '#14B8A6', '#115E59'],
  plum: ['#C084FC', '#9333EA', '#581C87'],
  crimson: ['#F87171', '#B91C1C', '#450A0A'],
  slate: ['#94A3B8', '#475569', '#1E293B'],
  midnight: ['#818CF8', '#4338CA', '#1E1B4B'],
  stone: ['#A8A29E', '#57534E', '#292524'],
  forest: ['#34D399', '#047857', '#022C22'],
};

type LangText = { ben: string; q: string; team: string; s: [string, string, string, string] };
type StoryText = { emoji: string; color: string; tr: LangText; en: LangText };

// s: [kalabalık, orta, nadir, veri yok (davet)]
export const STORY_TEXTS: Record<string, StoryText> = {
  lying: {
    emoji: "🛌",
    color: 'violet',
    tr: { ben: "Şu an uzanıyorum.", q: "kimler uzanıp keyif yapıyor?", team: "Yatay mod ekibi", s: ["Bugün herkes yatay modda.", "Yatay moddayım, yalnız değilim.", "Herkes ayakta, ben yatay moddayım.", "Uzanan başka kim var?"] },
    en: { ben: "Right now I'm lying down.", q: "Who's lying down and chilling", team: "Team Horizontal", s: ["Everyone's horizontal today.", "Horizontal mode, good company.", "Everyone's up, I'm in horizontal mode.", "Who else is lying down?"] },
  },
  work: {
    emoji: "💼",
    color: 'indigo',
    tr: { ben: "Şu an işteyim.", q: "kimler işte?", team: "Mesai ekibi", s: ["Bugün mesai herkes için başladı.", "Mesai arkadaşlarım her yerde.", "Herkes tatilde, ben işteyim.", "Mesai arkadaşım var mı?"] },
    en: { ben: "Right now I'm at work.", q: "Who's at work", team: "Team 9-to-5", s: ["The whole world has clocked in.", "Coworkers everywhere.", "Everyone's off, I'm working.", "Any coworkers out there?"] },
  },
  eat: {
    emoji: "🍽️",
    color: 'orange',
    tr: { ben: "Şu an yemek yiyorum.", q: "kimler yemek yiyor?", team: "Sofra ekibi", s: ["Herkes sofrada, afiyet olsun!", "Sofrada yalnız değilim.", "Bu saatte yemek? Benim tercihim.", "Sofraya katılan var mı?"] },
    en: { ben: "Right now I'm eating.", q: "Who's eating", team: "Team Table", s: ["Everyone's at the table. Bon appétit!", "Not eating alone.", "Eating at this hour? My call.", "Anyone joining the table?"] },
  },
  cook: {
    emoji: "🍳",
    color: 'red',
    tr: { ben: "Şu an yemek yapıyorum.", q: "kimler yemek yapıyor?", team: "Mutfak ekibi", s: ["Bugün mutfaklar dolu.", "Mutfakta yalnız değilim.", "Bu saatte mutfaktaki tek şef benim.", "Başka şef var mı?"] },
    en: { ben: "Right now I'm cooking.", q: "Who's cooking", team: "Team Kitchen", s: ["Kitchens are busy today.", "Not alone in the kitchen.", "The only chef at this hour.", "Any other chefs out there?"] },
  },
  travel: {
    emoji: "🚗",
    color: 'sky',
    tr: { ben: "Şu an yoldayım.", q: "kimler yolda?", team: "Yol ekibi", s: ["Bugün herkes yolda.", "Yolda yalnız değilim.", "Yollar bana kaldı.", "Yol arkadaşım var mı?"] },
    en: { ben: "Right now I'm on the road.", q: "Who's on the road", team: "Team Road", s: ["Everyone's on the move today.", "Not alone on the road.", "The road is all mine.", "Any travel buddies?"] },
  },
  study: {
    emoji: "📚",
    color: 'emerald',
    tr: { ben: "Şu an ders çalışıyorum.", q: "kimler ders çalışıyor?", team: "Kütüphane ekibi", s: ["Bugün herkes ders başında.", "Ders çalışan tek ben değilim.", "Herkes ertelerken ben çalışıyorum.", "Çalışma arkadaşım var mı?"] },
    en: { ben: "Right now I'm studying.", q: "Who's studying", team: "Team Library", s: ["Everyone's hitting the books today.", "Not the only one studying.", "While others procrastinate, I study.", "Any study buddies?"] },
  },
  sport: {
    emoji: "🏃",
    color: 'teal',
    tr: { ben: "Şu an spor yapıyorum.", q: "kimler spor yapıyor?", team: "İdman ekibi", s: ["Bugün herkes terliyor.", "Antrenmanda yalnız değilim.", "Az kişiyiz ama güçlüyüz.", "Antrenman arkadaşım var mı?"] },
    en: { ben: "Right now I'm working out.", q: "Who's working out", team: "Team Workout", s: ["Everyone's sweating today.", "Not training alone.", "Few of us, but strong.", "Any workout buddies?"] },
  },
  tv: {
    emoji: "📺",
    color: 'rose',
    tr: { ben: "Şu an dizi ya da film izliyorum.", q: "kimler dizi ya da film izliyor?", team: "Kanepe ekibi", s: ["Bugün kanepeler dolu.", "Kanepede yalnız değilim.", "Herkes dışarıda, ben dizimin başında.", "Benimle izleyen var mı?"] },
    en: { ben: "Right now I'm watching a show.", q: "Who's watching a show", team: "Team Couch", s: ["The couches are full today.", "Not alone on the couch.", "Everyone's out, I'm glued to my show.", "Anyone watching with me?"] },
  },
  coffee: {
    emoji: "☕",
    color: 'coffee',
    tr: { ben: "Şu an kahve içiyorum.", q: "kimler kahve içiyor?", team: "Kahve ekibi", s: ["Kafein herkesi yakaladı.", "Kahve molasında yalnız değilim.", "Bu saatte kahve? Cesur seçim.", "Kahveme eşlik eden var mı?"] },
    en: { ben: "Right now I'm having coffee.", q: "Who's having coffee", team: "Team Coffee", s: ["Caffeine got everyone.", "Not alone on my coffee break.", "Coffee at this hour? Bold choice.", "Who's having coffee with me?"] },
  },
  gaming: {
    emoji: "🎮",
    color: 'fuchsia',
    tr: { ben: "Şu an oyun oynuyorum.", q: "kimler oyun oynuyor?", team: "Oyuncu ekibi", s: ["Bugün herkes oyunda.", "Oyunda yalnız değilim.", "Az ama öz oyuncularız.", "Takım arkadaşım var mı?"] },
    en: { ben: "Right now I'm gaming.", q: "Who's gaming", team: "Team Gamer", s: ["Everyone's in the game today.", "Not gaming alone.", "Few players, true players.", "Any teammates out there?"] },
  },
  shop: {
    emoji: "🛍️",
    color: 'pink',
    tr: { ben: "Şu an alışveriş yapıyorum.", q: "kimler alışveriş yapıyor?", team: "Sepet ekibi", s: ["Bugün sepetler dolu.", "Sepet dolduran tek ben değilim.", "Mağazalar bana kaldı.", "Alışverişte yanımda kim var?"] },
    en: { ben: "Right now I'm shopping.", q: "Who's shopping", team: "Team Cart", s: ["Carts are full today.", "Not the only one filling a cart.", "The stores are all mine.", "Who's shopping with me?"] },
  },
  chores: {
    emoji: "🧹",
    color: 'cyan',
    tr: { ben: "Şu an ev işi yapıyorum.", q: "kimler ev işi yapıyor?", team: "Temizlik ekibi", s: ["Bugün her ev temizlikte.", "Ev işinde yalnız değilim.", "Herkes dinlenirken ben temizlikteyim.", "Temizlikte yalnız mıyım?"] },
    en: { ben: "Right now I'm doing chores.", q: "Who's doing chores", team: "Team Tidy", s: ["Everyone's cleaning today.", "Not the only one doing chores.", "Everyone rests, I clean.", "Am I cleaning alone?"] },
  },
  friends: {
    emoji: "🥳",
    color: 'tangerine',
    tr: { ben: "Şu an arkadaşlarımla birlikteyim.", q: "kimler arkadaşlarıyla birlikte?", team: "Kanka ekibi", s: ["Bugün herkes dostlarıyla.", "Dostlarla güzel bir an.", "Az kişiyiz ama en keyifli masadayız.", "Siz de dostlarınızla mısınız?"] },
    en: { ben: "Right now I'm with friends.", q: "Who's with friends", team: "Team Squad", s: ["Everyone's with their people today.", "A good moment with friends.", "Few of us, but at the best table.", "Are you with your people too?"] },
  },
  scrolling: {
    emoji: "📱",
    color: 'navy',
    tr: { ben: "Şu an telefonda geziniyorum.", q: "kimler telefonda geziniyor?", team: "Ekran ekibi", s: ["Bugün herkes ekrana gömülmüş.", "Telefonda gezinen tek ben değilim.", "Herkes telefonu bırakmış, bir ben ekrandayım.", "Sen de mi telefondasın?"] },
    en: { ben: "Right now I'm on my phone.", q: "Who's on their phone", team: "Team Screen", s: ["Everyone's glued to their screens today.", "Not the only one on my phone.", "Everyone put their phone down but me.", "On your phone too?"] },
  },
  resting: {
    emoji: "🌿",
    color: 'green',
    tr: { ben: "Şu an dinleniyorum.", q: "kimler dinleniyor?", team: "Mola ekibi", s: ["Bugün herkes şarj oluyor.", "Molada yalnız değilim.", "Herkes koşturuyor, ben dinleniyorum.", "Mola veren başka kim var?"] },
    en: { ben: "Right now I'm resting.", q: "Who's resting", team: "Team Recharge", s: ["Everyone's recharging today.", "Not alone on my break.", "Everyone rushes, I rest.", "Who else is taking a break?"] },
  },
  happy: {
    emoji: "😄",
    color: 'sunset',
    tr: { ben: "Şu an neşeliyim.", q: "kimler neşeli?", team: "Neşe ekibi", s: ["Bugün neşe bulaşıcı.", "Neşem yalnız değil.", "Az kişiyiz ama çok neşeliyiz.", "Bu neşeye ortak olan var mı?"] },
    en: { ben: "Right now I'm happy.", q: "Who's happy", team: "Team Smile", s: ["Joy is contagious today.", "My joy has company.", "Few of us, full of joy.", "Anyone sharing the joy?"] },
  },
  calm: {
    emoji: "😌",
    color: 'seafoam',
    tr: { ben: "Şu an huzurluyum.", q: "kimler huzurlu?", team: "Huzur ekibi", s: ["Bugün herkes huzurlu.", "Huzurda yalnız değilim.", "Kaosun ortasında huzur bulmuşum.", "Bu sakinliği paylaşan var mı?"] },
    en: { ben: "Right now I'm at peace.", q: "Who's at peace", team: "Team Calm", s: ["Everyone's at peace today.", "Not alone in this calm.", "Found calm in the chaos.", "Anyone sharing this calm?"] },
  },
  hurt: {
    emoji: "💔",
    color: 'plum',
    tr: { ben: "Şu an kırgınım.", q: "kimler kırgın?", team: "Dayanışma ekibi", s: ["Bugün kırgın olan çok. Yalnız değiliz.", "Kırgınım ama yalnız değilim.", "Az kişiyiz, ama geçecek.", "Geçecek, biliyorum."] },
    en: { ben: "Right now I'm feeling hurt.", q: "Who's feeling hurt", team: "Team Hang In There", s: ["Many of us are hurting today. We're not alone.", "Hurt, but not alone.", "Few of us, and it will pass.", "It will pass, I know."] },
  },
  angry: {
    emoji: "😤",
    color: 'crimson',
    tr: { ben: "Şu an öfkeliyim.", q: "kimler öfkeli?", team: "Derin nefes ekibi", s: ["Bugün sinirler gergin.", "Öfkemde yalnız değilim.", "Herkes sakin, bir ben sinirliyim.", "On'a kadar sayıyorum."] },
    en: { ben: "Right now I'm angry.", q: "Who's angry", team: "Team Deep Breath", s: ["Tempers are running high today.", "Not the only one fuming.", "Everyone's calm, I'm fuming.", "Counting to ten."] },
  },
  bored: {
    emoji: "🥱",
    color: 'slate',
    tr: { ben: "Şu an sıkılıyorum.", q: "kimler sıkılıyor?", team: "Esneme ekibi", s: ["Bugün herkes sıkılıyor.", "Sıkılan tek ben değilim.", "Herkes meşgul, bir ben sıkılıyorum.", "Biri bir şey desin."] },
    en: { ben: "Right now I'm bored.", q: "Who's bored", team: "Team Yawn", s: ["Everyone's bored today.", "Not the only one bored.", "Everyone's busy, I'm bored.", "Someone say something."] },
  },
  procrastinating: {
    emoji: "⏳",
    color: 'midnight',
    tr: { ben: "Şu an erteliyorum.", q: "kimler erteliyor?", team: "Yarın ekibi", s: ["Bugün herkes erteliyor. Yarın bakarız.", "Ertelemede yalnız değilim.", "Herkes çalışıyor, ben yarına bırakıyorum.", "Yarın hallederiz, söz."] },
    en: { ben: "Right now I'm procrastinating.", q: "Who's procrastinating", team: "Team Tomorrow", s: ["Everyone's procrastinating. Tomorrow, then.", "Not the only procrastinator.", "Everyone's working, I'll do it tomorrow.", "Tomorrow, I promise."] },
  },
  nothing: {
    emoji: "🪑",
    color: 'stone',
    tr: { ben: "Şu an boş boş oturuyorum.", q: "kimler boş boş oturuyor?", team: "Keyif ekibi", s: ["Bugün herkes boş boş oturuyor.", "Hiçbir şey yapmayan tek ben değilim.", "Herkes koşturuyor, ben keyif yapıyorum.", "Benimle boş boş oturan var mı?"] },
    en: { ben: "Right now I'm just sitting around.", q: "Who's just sitting around", team: "Team Chill", s: ["Everyone's doing nothing today.", "Not the only one doing nothing.", "Everyone rushes, I chill.", "Anyone doing nothing with me?"] },
  },
  money: {
    emoji: "💸",
    color: 'forest',
    tr: { ben: "Şu an borçlarımı düşünüyorum.", q: "kimler borçlarını düşünüyor?", team: "Hesap kitap ekibi", s: ["Bugün borç düşünen çok. Yalnız değiliz.", "Borçlarımı düşünüyorum ama yalnız değilim.", "Az kişiyiz, ama hesap bir gün tutacak.", "Umarım yalnız değilimdir."] },
    en: { ben: "Right now I'm worrying about debts.", q: "Who's worrying about debts", team: "Team Budget", s: ["Many of us are worrying today. We're not alone.", "Worrying, but not alone.", "Few of us, and the math will work out one day.", "Hopefully I'm not alone."] },
  },
};

// ---- Türkçe ek yardımcıları ----
const BACK = 'aıou';
const FRONT = 'eiöü';
const HARD = 'fstkçşhp';

function lastVowel(word: string): string {
  const w = word.toLocaleLowerCase('tr-TR');
  for (let i = w.length - 1; i >= 0; i--) if (BACK.includes(w[i]) || FRONT.includes(w[i])) return w[i];
  return 'e';
}

// Özel isimlere bulunma eki: Türkiye'de, Irak'ta, İstanbul'da, Amerika Birleşik Devletleri'nde
export function locative(name: string): string {
  const low = name.toLocaleLowerCase('tr-TR');
  const back = BACK.includes(lastVowel(name));
  if (/(leri|ları)$/.test(low)) return `${name}'n${back ? 'da' : 'de'}`;
  const d = HARD.includes(low[low.length - 1]) ? 't' : 'd';
  return `${name}'${d}${back ? 'a' : 'e'}`;
}

// Sayılara iyelik eki: 1'i, 3'ü, 6'sı, 12'si, 23'ü, 40'ı, 100'ü
export function numberSuffix(n: number): string {
  if (n % 100 === 0) return 'ü';
  const ones: Record<number, string> = { 1: 'i', 2: 'si', 3: 'ü', 4: 'ü', 5: 'i', 6: 'sı', 7: 'si', 8: 'i', 9: 'u' };
  const tens: Record<number, string> = { 10: 'u', 20: 'si', 30: 'u', 40: 'ı', 50: 'si', 60: 'ı', 70: 'i', 80: 'i', 90: 'ı' };
  return n % 10 !== 0 ? ones[n % 10] : tens[n % 100];
}

export function tierOf(pct: number | null): Tier {
  if (pct === null) return 'none';
  if (pct >= 20) return 'crowd';
  if (pct >= 5) return 'mid';
  if (pct >= 1) return 'rare';
  return 'ultra';
}

const BADGES: Record<Tier, { tr: string; en: string }> = {
  crowd: { tr: '🔥 Kalabalığız', en: '🔥 We’re a crowd' },
  mid: { tr: '👥 Yalnız değilim', en: '👥 Not alone' },
  rare: { tr: '🦄 Nadir türdenim', en: '🦄 Rare breed' },
  ultra: { tr: '💎 Çok nadir', en: '💎 Super rare' },
  none: { tr: '⭐ İlk gelenlerdenim', en: '⭐ Early bird' },
};

const DAYS = {
  tr: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

// Filtreye göre kapsam ifadesi ("Türkiye'de", "in Germany", "25-34 yaş grubunda")
function scopePhrase(filter: string, value: string | null | undefined, lang: Lang): string {
  const world = lang === 'tr' ? 'dünyada' : 'in the world';
  if (!value) return world;
  switch (filter) {
    case 'country':
      if (value === COUNTRY_OTHER) return world;
      return lang === 'tr' ? locative(countryLabel(value, 'tr')) : `in ${countryLabel(value, 'en')}`;
    case 'city':
      return lang === 'tr' ? locative(value) : `in ${value}`;
    case 'age':
      return lang === 'tr' ? `${value} yaş grubunda` : `among ${value}-year-olds`;
    case 'gender':
      if (value === GENDER_NO_ANSWER) return world;
      if (value === 'Kadın') return lang === 'tr' ? 'kadınlar arasında' : 'among women';
      return lang === 'tr' ? 'erkekler arasında' : 'among men';
    default:
      return world;
  }
}

export type Story = {
  tier: Tier;
  emoji: string;
  colors: [string, string, string];
  badge: string;
  when: string;
  question: string;
  answer: [string, string, string]; // [önce, vurgulu, sonra]
  slogan: string | null;
  ctaTeam: [string, string, string]; // [önce, ekip (kalın), sonra]
};

export function buildStory(opts: {
  activityId: string;
  lang: Lang;
  pct: number | null;
  filter: string;
  value: string | null | undefined;
  date?: Date;
}): Story {
  const { activityId, lang, pct, filter, value } = opts;
  const date = opts.date ?? new Date();
  const data = STORY_TEXTS[activityId] ?? STORY_TEXTS.nothing;
  const t = data[lang];
  const tier = tierOf(pct);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const when = `${DAYS[lang][date.getDay()]} · ${hh}:${mm}`;
  const scope = scopePhrase(filter, value, lang);

  let question: string;
  let answer: [string, string, string];
  let slogan: string | null;

  if (tier === 'none' || pct === null) {
    question = t.ben;
    answer = ['', t.s[3], ''];
    slogan = null;
  } else {
    question = lang === 'tr' ? `Şu an ${scope} ${t.q}` : `${t.q} ${scope} right now?`;
    const per = tier === 'ultra' ? 1000 : 100;
    const n = Math.max(1, Math.round((pct / 100) * per));
    if (lang === 'tr') {
      const only = tier === 'rare' || tier === 'ultra' ? 'sadece ' : '';
      const tail = only ? ' Ben de dahil.' : ' Ben de onlardan biriyim.';
      answer = [`Şu An'daki her ${per} kişiden ${only}`, `${n}'${numberSuffix(n)}.`, tail];
    } else {
      const only = tier === 'rare' || tier === 'ultra' ? 'Only ' : '';
      const tail = only ? ' people on Şu An. Me included.' : ' people on Şu An. I’m one of them.';
      answer = [only, `${n} in every ${per === 1000 ? '1,000' : '100'}`, tail];
    }
    slogan = tier === 'crowd' ? t.s[0] : tier === 'mid' ? t.s[1] : t.s[2];
  }

  const ctaTeam: [string, string, string] =
    lang === 'tr' ? ['Ben ', `${t.team}ndeyim.`, ' Sen hangi ekiptesin?'] : ['I’m on ', `${t.team}.`, ' Which team are you on?'];

  return {
    tier,
    emoji: data.emoji,
    colors: STORY_COLORS[data.color] ?? STORY_COLORS.indigo,
    badge: BADGES[tier][lang],
    when,
    question,
    answer,
    slogan,
    ctaTeam,
  };
}

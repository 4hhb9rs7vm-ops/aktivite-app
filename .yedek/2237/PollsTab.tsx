// Alt bant · Anketler sekmesi
// Üstte lacivert başlık + özet (kaç gün cevapladın, seri).
// Bugünün kartı: cevap vermediysen şıklar burada; verdiysen 21:00 geri sayımı; 21:00'den sonra sonuç.
// Altında geçmiş günler: çizim, soru, senin cevabın ve yüzdesi. Dokununca sonuç ekranı açılır (story paylaşımı dahil).
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { SvgXml } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Lang } from '@/lib/i18n';
import {
  clubName,
  dayLabel,
  fetchPollHistory,
  getStreak,
  isBeforeResults,
  istanbulToday,
  markRevealed,
  optionLabel,
  PendingReveal,
  PollItem,
  questionText,
  SERIES_LENGTH,
  submitAnswer,
  THEMES,
  themeOf,
} from '@/lib/dailyQuestion';
import { DailyResultReveal } from '@/components/DailyResultReveal';
import { scheduleResultNotification } from '@/lib/notifications';

const NAVY = '#0F2A52';
const AMBER = '#FBBF24';
const AMBER_BG = '#FFF3E4';
const AMBER_FG = '#B45309';
const INK = '#16161a';
const SOFT = '#5b5b66';
const LINE = '#E6E8F0';
const F = { regular: 'DMSans_400Regular', medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' };

const TEXT = {
  tr: {
    title: 'Anketler',
    subtitle: `${SERIES_LENGTH} Gün ${SERIES_LENGTH} Soru`,
    answered: (n: number) => `${n}/${SERIES_LENGTH} gün cevapladın`,
    streak: (n: number) => `${n} günlük seri`,
    today: 'BUGÜNÜN SORUSU',
    day: (n: number) => `Gün ${n}/${SERIES_LENGTH}`,
    pickHint: "Herkese aynı soru. Sonuç akşam 21:00'de.",
    yours: 'Senin cevabın',
    countdown: (h: number, m: number) => (h > 0 ? `Sonuç ${h} sa ${m} dk sonra` : `Sonuç ${m} dk sonra`),
    at21: "Sonuçlar 21:00'de açıklanacak",
    seeResult: 'Sonucu gör',
    waiting: 'Sonuç hesaplanıyor, birazdan burada.',
    closed: 'Bu soru kapandı.',
    majority: (o: string, p: number) => `Çoğunluk: ${o} %${p}`,
    past: 'Geçmiş sorular',
    notAnswered: 'Cevaplamadın',
    you: (o: string, p: number | null) => (p === null ? `Sen: ${o}` : `Sen: ${o} · %${p}`),
    empty: "İlk soru 1 Kasım'da geliyor.",
    emptySub: "Her gün tek soru, akşam 21:00'de sonuç.",
    error: 'Bağlantı kurulamadı. Aşağı çekip yenile.',
    shareTitle: 'Günün Sorusu',
  },
  en: {
    title: 'Polls',
    subtitle: `${SERIES_LENGTH} Days ${SERIES_LENGTH} Questions`,
    answered: (n: number) => `Answered ${n}/${SERIES_LENGTH} days`,
    streak: (n: number) => `${n}-day streak`,
    today: "TODAY'S QUESTION",
    day: (n: number) => `Day ${n}/${SERIES_LENGTH}`,
    pickHint: 'Same question for everyone. Results at 9 pm.',
    yours: 'Your answer',
    countdown: (h: number, m: number) => (h > 0 ? `Results in ${h}h ${m}m` : `Results in ${m}m`),
    at21: 'Results drop at 9 pm',
    seeResult: 'See the result',
    waiting: 'Counting votes, check back in a moment.',
    closed: 'This question is closed.',
    majority: (o: string, p: number) => `Most said: ${o} ${p}%`,
    past: 'Past questions',
    notAnswered: "You didn't answer",
    you: (o: string, p: number | null) => (p === null ? `You: ${o}` : `You: ${o} · ${p}%`),
    empty: 'The first question arrives on November 1.',
    emptySub: 'One question a day, results at 9 pm.',
    error: "Couldn't connect. Pull down to refresh.",
    shareTitle: 'Question of the Day',
  },
};

type Props = {
  lang: Lang;
  topInset: number;
  bottomSpace: number;
};

// 21:00'e (İstanbul) kalan süre
function untilResults(): { h: number; m: number } {
  const now = new Date();
  const ist = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const mins = 21 * 60 - (ist.getUTCHours() * 60 + ist.getUTCMinutes());
  const left = Math.max(0, mins);
  return { h: Math.floor(left / 60), m: left % 60 };
}

function topOption(item: PollItem, lang: Lang): { label: string; pct: number } | null {
  if (!item.result) return null;
  let best: { label: string; pct: number } | null = null;
  for (const o of item.question.options) {
    const p = Math.round(item.result.pct[o.key] ?? 0);
    if (!best || p > best.pct) best = { label: optionLabel(o, lang), pct: p };
  }
  return best;
}

export function PollsTab({ lang, topInset, bottomSpace }: Props) {
  const tx = (lang as string) === 'tr' ? TEXT.tr : TEXT.en;
  const [items, setItems] = useState<PollItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [streak, setStreak] = useState(0);
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ data: PendingReveal; kicker: string } | null>(null);
  const [, setTick] = useState(0); // geri sayım için dakikada bir yeniden çiz
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const list = await fetchPollHistory(lang);
      if (!mounted.current) return;
      setItems(list);
      setFailed(false);
      setStreak(await getStreak());
    } catch {
      if (mounted.current) setFailed(true);
    }
  }, [lang]);

  useEffect(() => {
    mounted.current = true;
    load();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') load();
    });
    const timer = setInterval(() => setTick((n) => n + 1), 30000);
    return () => {
      mounted.current = false;
      sub.remove();
      clearInterval(timer);
    };
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const today = istanbulToday();
  const todayItem = items?.find((i) => i.question.day_date === today) ?? null;
  const pastItems = (items ?? []).filter((i) => i.question.day_date !== today);
  const answeredCount = (items ?? []).filter((i) => i.myKey && i.question.series_day).length;
  const before21 = isBeforeResults();

  async function pickToday(key: string) {
    if (!todayItem || sendingKey) return;
    Haptics.selectionAsync().catch(() => {});
    setSendingKey(key);
    const saved = await submitAnswer(todayItem.question, key, lang);
    setSendingKey(null);
    if (!saved) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const savedOption = todayItem.question.options.find((o) => o.key === saved);
    scheduleResultNotification(todayItem.question.day_date, savedOption ? clubName(savedOption, lang) : null);
    setItems((prev) =>
      prev ? prev.map((i) => (i.question.id === todayItem.question.id ? { ...i, myKey: saved } : i)) : prev
    );
    setStreak(await getStreak());
  }

  function openResult(item: PollItem) {
    if (!item.result || !item.myKey) return;
    Haptics.selectionAsync().catch(() => {});
    markRevealed(item.question.day_date);
    const isToday = item.question.day_date === today;
    setReveal({
      data: { question: item.question, myKey: item.myKey, result: item.result, isYesterday: !isToday },
      kicker: dayLabel(item.question.day_date, lang),
    });
  }

  function onRevealClose(shareUri: string | null) {
    setReveal(null);
    if (!shareUri) return;
    // Modal tamamen kapandıktan sonra paylaşma penceresi (iOS'ta modal üstünde açılmıyor)
    setTimeout(
      async () => {
        try {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(shareUri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: tx.shareTitle });
          }
        } catch {}
      },
      Platform.OS === 'ios' ? 1200 : 450
    );
  }

  // ---------------------------------------------------------------- bugünün kartı
  function renderToday(item: PollItem) {
    const q = item.question;
    const qText = questionText(q, lang) ?? q.question_tr;
    const myOption = q.options.find((o) => o.key === item.myKey) ?? null;
    const myPct = item.result && item.myKey ? Math.round(item.result.pct[item.myKey] ?? 0) : null;
    const top = topOption(item, lang);
    const left = untilResults();

    return (
      <View style={styles.todayCard}>
        <View style={styles.todayTop}>
          <View style={styles.labelPill}>
            <Text style={styles.label}>{tx.today}</Text>
          </View>
          {q.series_day ? (
            <View style={styles.dayPill}>
              <Text style={styles.dayPillText}>{tx.day(q.series_day)}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.todayQuestion}>{qText}</Text>

        {!item.myKey && before21 ? (
          // Cevaplanmadı: şıklar burada
          <View style={{ gap: 8, marginTop: 14 }}>
            <Text style={styles.hint}>{tx.pickHint}</Text>
            {q.options.map((o, i) => (
              <Pressable
                key={o.key}
                onPress={() => pickToday(o.key)}
                disabled={!!sendingKey}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed, sendingKey === o.key && styles.optionActive]}
                accessibilityRole="button"
              >
                <View style={[styles.letter, sendingKey === o.key && styles.letterActive]}>
                  <Text style={[styles.letterText, sendingKey === o.key && { color: '#fff' }]}>
                    {String.fromCharCode(65 + i)}
                  </Text>
                </View>
                <Text style={[styles.optionText, sendingKey === o.key && { color: '#fff' }]}>{optionLabel(o, lang)}</Text>
                {sendingKey === o.key ? <ActivityIndicator color="#fff" /> : null}
              </Pressable>
            ))}
          </View>
        ) : item.myKey && before21 ? (
          // Cevaplandı, 21:00 bekleniyor
          <View style={styles.waitBox}>
            <Text style={styles.waitLabel}>{tx.yours}</Text>
            <Text style={styles.waitAnswer}>{myOption ? optionLabel(myOption, lang) : '—'}</Text>
            {myOption && clubName(myOption, lang) ? (
              <Text style={styles.waitClub}>{clubName(myOption, lang)}</Text>
            ) : null}
            <View style={styles.countRow}>
              <Ionicons name="time-outline" size={18} color={AMBER_FG} />
              <Text style={styles.countText}>{tx.countdown(left.h, left.m)}</Text>
            </View>
          </View>
        ) : item.myKey ? (
          // 21:00 sonrası, cevaplandı
          item.result ? (
            <View style={{ gap: 10, marginTop: 14 }}>
              <View style={styles.waitBox}>
                <Text style={styles.waitLabel}>{tx.yours}</Text>
                <Text style={styles.waitAnswer}>
                  {myOption ? optionLabel(myOption, lang) : '—'}
                  {myPct !== null ? <Text style={styles.waitPct}>{`  %${myPct}`}</Text> : null}
                </Text>
              </View>
              <Pressable onPress={() => openResult(item)} style={styles.seeBtn} accessibilityRole="button">
                <Text style={styles.seeText}>{tx.seeResult}</Text>
                <Ionicons name="arrow-forward" size={20} color={NAVY} />
              </Pressable>
            </View>
          ) : (
            <Text style={[styles.hint, { marginTop: 12 }]}>{tx.waiting}</Text>
          )
        ) : (
          // 21:00 sonrası, cevaplanmadı
          <View style={{ marginTop: 12, gap: 6 }}>
            <Text style={styles.hint}>{tx.closed}</Text>
            {top ? <Text style={styles.majorityText}>{tx.majority(top.label, top.pct)}</Text> : null}
          </View>
        )}
      </View>
    );
  }

  // ---------------------------------------------------------------- geçmiş satırı
  function renderPast(item: PollItem) {
    const q = item.question;
    const t = THEMES[themeOf(q)];
    const qText = questionText(q, lang) ?? q.question_tr;
    const myOption = q.options.find((o) => o.key === item.myKey) ?? null;
    const myPct = item.result && item.myKey ? Math.round(item.result.pct[item.myKey] ?? 0) : null;
    const top = topOption(item, lang);
    const club = myOption ? clubName(myOption, lang) : null;
    const tappable = !!(item.result && item.myKey);

    return (
      <Pressable
        key={q.id}
        onPress={() => openResult(item)}
        disabled={!tappable}
        style={({ pressed }) => [styles.row, pressed && tappable && styles.rowPressed]}
        accessibilityRole={tappable ? 'button' : undefined}
      >
        <View style={[styles.thumb, { backgroundColor: t.bg }]}>
          {q.art_svg ? <SvgXml xml={q.art_svg} width="100%" height="100%" /> : null}
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.rowDay}>
            {dayLabel(q.day_date, lang)}
            {q.series_day ? ` · ${tx.day(q.series_day)}` : ''}
          </Text>
          <Text style={styles.rowQuestion} numberOfLines={2}>
            {qText}
          </Text>
          {myOption ? (
            <Text style={styles.rowMine} numberOfLines={1}>
              {tx.you(optionLabel(myOption, lang), myPct)}
              {club ? <Text style={styles.rowClub}>{`  ${club}`}</Text> : null}
            </Text>
          ) : (
            <Text style={styles.rowMuted} numberOfLines={1}>
              {top ? tx.majority(top.label, top.pct) : tx.notAnswered}
            </Text>
          )}
        </View>
        {tappable ? <Ionicons name="chevron-forward" size={20} color="#A0A4B0" /> : null}
      </Pressable>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomSpace }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />}
      >
        <View style={[styles.header, { paddingTop: topInset + 18 }]}>
          <Text style={styles.subtitle}>{tx.subtitle}</Text>
          <Text style={styles.title}>{tx.title}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="checkmark-circle" size={16} color={AMBER} />
              <Text style={styles.statText}>{tx.answered(answeredCount)}</Text>
            </View>
            {streak > 1 ? (
              <View style={styles.stat}>
                <Ionicons name="flame" size={16} color={AMBER} />
                <Text style={styles.statText}>{tx.streak(streak)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.body}>
          {items === null && !failed ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={NAVY} />
          ) : failed ? (
            <Text style={[styles.hint, { textAlign: 'center', marginTop: 30 }]}>{tx.error}</Text>
          ) : items && items.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="chatbubbles-outline" size={34} color={AMBER_FG} />
              <Text style={styles.emptyTitle}>{tx.empty}</Text>
              <Text style={styles.hint}>{tx.emptySub}</Text>
            </View>
          ) : (
            <>
              {todayItem ? renderToday(todayItem) : null}
              {pastItems.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>{tx.past}</Text>
                  <View style={styles.list}>{pastItems.map(renderPast)}</View>
                </>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      {reveal ? (
        <DailyResultReveal data={reveal.data} lang={lang} onClose={onRevealClose} autoReveal kicker={reveal.kicker} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: NAVY,
    paddingHorizontal: 20,
    paddingBottom: 56,
  },
  subtitle: {
    fontFamily: F.bold,
    fontSize: 13,
    letterSpacing: 1.2,
    color: AMBER,
  },
  title: {
    marginTop: 4,
    fontFamily: F.bold,
    fontSize: 32,
    letterSpacing: -0.6,
    color: '#ffffff',
  },
  statsRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  statText: {
    fontFamily: F.bold,
    fontSize: 13,
    color: '#ffffff',
  },
  body: {
    marginTop: -40,
    paddingHorizontal: 16,
  },
  todayCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    shadowColor: '#0F1A33',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  todayTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: AMBER_BG,
  },
  label: {
    fontFamily: F.bold,
    fontSize: 12,
    letterSpacing: 1.1,
    color: AMBER_FG,
  },
  dayPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: NAVY,
  },
  dayPillText: {
    fontFamily: F.bold,
    fontSize: 12,
    color: '#ffffff',
  },
  todayQuestion: {
    marginTop: 12,
    fontFamily: F.bold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
    color: INK,
  },
  hint: {
    fontFamily: F.medium,
    fontSize: 14,
    lineHeight: 20,
    color: SOFT,
  },
  option: {
    minHeight: 54,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: LINE,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionPressed: {
    backgroundColor: '#F3F4F8',
  },
  optionActive: {
    backgroundColor: NAVY,
    borderColor: NAVY,
  },
  letter: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#F3F4F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  letterText: {
    fontFamily: F.bold,
    fontSize: 14,
    color: NAVY,
  },
  optionText: {
    flex: 1,
    fontFamily: F.bold,
    fontSize: 17,
    color: INK,
  },
  waitBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: AMBER_BG,
    gap: 2,
  },
  waitLabel: {
    fontFamily: F.medium,
    fontSize: 13,
    color: AMBER_FG,
  },
  waitAnswer: {
    fontFamily: F.bold,
    fontSize: 20,
    color: NAVY,
  },
  waitPct: {
    fontFamily: F.bold,
    fontSize: 18,
    color: AMBER_FG,
  },
  waitClub: {
    fontFamily: F.bold,
    fontSize: 14,
    color: NAVY,
    opacity: 0.75,
  },
  countRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countText: {
    fontFamily: F.bold,
    fontSize: 15,
    color: AMBER_FG,
  },
  seeBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: AMBER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  seeText: {
    fontFamily: F.bold,
    fontSize: 17,
    color: NAVY,
  },
  majorityText: {
    fontFamily: F.bold,
    fontSize: 16,
    color: NAVY,
  },
  sectionTitle: {
    marginTop: 26,
    marginBottom: 10,
    marginLeft: 4,
    fontFamily: F.bold,
    fontSize: 18,
    color: INK,
  },
  list: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F1F5',
  },
  rowPressed: {
    backgroundColor: '#F6F7FA',
  },
  thumb: {
    width: 64,
    height: 52,
    borderRadius: 12,
    overflow: 'hidden',
  },
  rowDay: {
    fontFamily: F.bold,
    fontSize: 12,
    color: '#8A8E99',
  },
  rowQuestion: {
    fontFamily: F.bold,
    fontSize: 15,
    lineHeight: 20,
    color: INK,
  },
  rowMine: {
    fontFamily: F.bold,
    fontSize: 13,
    color: AMBER_FG,
  },
  rowClub: {
    fontFamily: F.medium,
    color: NAVY,
  },
  rowMuted: {
    fontFamily: F.medium,
    fontSize: 13,
    color: '#8A8E99',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontFamily: F.bold,
    fontSize: 19,
    color: INK,
    textAlign: 'center',
  },
});

// 1.6.0: Mesaj kutusu sekmesi (Rozetler sekmesinin yerinde).
// Üstte "İlk günden beri" özeti ve rozetler; altında son 30 gün, günlere ve aktivitelere göre:
// bana sorulan soru (tek cevap herkese gider), bana bırakılan tepkiler (yalnızca emoji), benim sorum ve cevapların oranı,
// selam ve o gün kazanılan rozet. Kişi sayısı gösterilmez.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';

import { activityName, type Lang } from '@/lib/i18n';
import { dayLabel, istanbulToday, istanbulYesterday } from '@/lib/dailyQuestion';
import { BADGE_BY_ID, badgeName, getEarnedBadges, onBadgesChanged, type BadgeId } from '@/lib/badges';
import { receivedSelamTotal } from '@/lib/selam';
import { findReaction, type CatOption } from '@/lib/catalog';
import {
  fetchInbox,
  fetchTotals,
  markInboxSeen,
  onInboxChanged,
  replyGroup,
  type InboxDay,
  type Totals,
} from '@/lib/inbox';
import { BadgesTab } from '@/components/BadgesTab';

const F = { medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' };
const NAVY = '#0F2A52';
const PEACH = '#F4B88A';
const BRAND = '#4F46E5';
const BG = '#F6F7FB';

const TEXT = {
  tr: {
    title: 'Mesaj kutusu',
    since: 'İLK GÜNDEN BERİ',
    days: (n: number) => (n <= 1 ? 'Bugün geldin' : `${n} gündür buradasın`),
    selam: 'selam',
    react: 'tepki',
    badges: 'rozet',
    today: 'Bugün',
    yesterday: 'Dün',
    askThem: 'sana soruyorlar',
    answered: 'Cevapladın:',
    yourQ: 'Senin sorun',
    waiting: 'Cevap bekleniyor…',
    selamGot: '👋 Selam geldi',
    newBadge: (n: string) => `🏅 Yeni rozet: ${n}`,
    older: 'Daha eski günler',
    emptyTitle: 'Henüz bir şey gelmedi',
    emptyBody: 'Bir an seç, aynı şeyi yapanlara selam ya da tepki bırak. Gelenler ve sorularının cevapları buraya düşer.',
    emptyBtn: 'Ne yapıyorsun? →',
    fromSame: 'aynı anı seçenlerden',
    error: 'Bağlantı yok, biraz sonra tekrar dene.',
  },
  en: {
    title: 'Inbox',
    since: 'SINCE DAY ONE',
    days: (n: number) => (n <= 1 ? 'You joined today' : `Here for ${n} days`),
    selam: 'hellos',
    react: 'reactions',
    badges: 'badges',
    today: 'Today',
    yesterday: 'Yesterday',
    askThem: 'they ask you',
    answered: 'You answered:',
    yourQ: 'Your question',
    waiting: 'Waiting for answers…',
    selamGot: '👋 You got hellos',
    newBadge: (n: string) => `🏅 New badge: ${n}`,
    older: 'Older days',
    emptyTitle: 'Nothing here yet',
    emptyBody: 'Pick a moment and leave a hello or a reaction for people doing the same. What you get lands here.',
    emptyBtn: 'What are you doing? →',
    fromSame: 'from people in the same moment',
    error: 'No connection, try again a bit later.',
  },
};

const label = (o: { tr: string; en: string }, lang: Lang) => ((lang as string) === 'tr' ? o.tr : o.en);

type Props = {
  lang: Lang;
  topInset: number;
  bottomSpace: number;
  showBadges: boolean; // rozetler yalnızca anketlerin açık olduğu dillerde
  onOpenNow: () => void;
  onOpenPolls: () => void;
};

export function InboxTab({ lang, topInset, bottomSpace, showBadges, onOpenNow, onOpenPolls }: Props) {
  const tx = (lang as string) === 'tr' ? TEXT.tr : TEXT.en;
  const [days, setDays] = useState<InboxDay[] | null>(null);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [localSelam, setLocalSelam] = useState(0);
  const [earned, setEarned] = useState<Record<string, string>>({});
  const [badgesOpen, setBadgesOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    const [page, t, sel, e] = await Promise.all([fetchInbox(), fetchTotals(), receivedSelamTotal(), getEarnedBadges()]);
    if (!alive.current) return;
    setEarned(e);
    setLocalSelam(sel);
    if (t) setTotals(t);
    if (page) {
      setDays(page.days);
      setMore(page.more);
      setFailed(false);
      markInboxSeen().catch(() => {});
    } else {
      setDays((d) => d ?? []);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    const off1 = onInboxChanged(() => {});
    const off2 = onBadgesChanged(() => {
      getEarnedBadges()
        .then((e) => alive.current && setEarned(e))
        .catch(() => {});
    });
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') load();
    });
    return () => {
      alive.current = false;
      off1();
      off2();
      sub.remove();
    };
  }, [load]);

  async function loadOlder() {
    if (!days || !days.length || loadingMore) return;
    setLoadingMore(true);
    const page = await fetchInbox(days[days.length - 1].day);
    setLoadingMore(false);
    if (!alive.current || !page) return;
    setDays([...days, ...page.days]);
    setMore(page.more);
  }

  async function answer(day: string, activity: string, key: string, reply: string) {
    const id = `${day}:${activity}:${key}`;
    if (busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setBusy(id);
    const ok = await replyGroup(day, activity, key, reply);
    setBusy(null);
    if (!ok || !alive.current) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setDays((ds) =>
      (ds ?? []).map((d) =>
        d.day !== day
          ? d
          : {
              ...d,
              cards: d.cards.map((c) =>
                c.activity !== activity
                  ? c
                  : { ...c, asks: c.asks.map((a) => (a.key === key ? { ...a, reply, pending: false } : a)) }
              ),
            }
      )
    );
  }

  if (badgesOpen && showBadges) {
    return (
      <BadgesTab
        lang={lang}
        topInset={topInset}
        bottomSpace={bottomSpace}
        onOpenPolls={onOpenPolls}
        onBack={() => setBadgesOpen(false)}
      />
    );
  }

  const today = istanbulToday();
  const yesterday = istanbulYesterday();
  const dayName = (d: string) => (d === today ? tx.today : d === yesterday ? tx.yesterday : dayLabel(d, lang));

  // Rozetler: kazanıldığı gün akışa da düşer (yüklenen günlerin aralığında)
  const badgeDays: Record<string, BadgeId[]> = {};
  const oldest = days && days.length ? days[days.length - 1].day : today;
  const floor = more ? oldest : addDays(today, -29);
  for (const [id, d] of Object.entries(earned) as [string, string][]) {
    if (!BADGE_BY_ID[id as BadgeId] || d < floor || d > today) continue;
    (badgeDays[d] = badgeDays[d] ?? []).push(id as BadgeId);
  }
  const feed: InboxDay[] = [...(days ?? [])];
  for (const d of Object.keys(badgeDays)) {
    if (!feed.find((x) => x.day === d)) feed.push({ day: d, selam: false, cards: [] });
  }
  feed.sort((a, b) => (a.day < b.day ? 1 : -1));

  const badgeCount = Object.keys(earned).filter((k) => BADGE_BY_ID[k as BadgeId]).length;
  const selamTotal = Math.max(localSelam, totals?.selamGot ?? 0);
  const firstDay = totals?.firstDay ?? null;
  const daysHere = firstDay ? Math.max(1, Math.round((Date.parse(today) - Date.parse(firstDay)) / 86400000) + 1) : 1;
  const boxes: { n: number; label: string; onPress?: () => void }[] = [];
  if (selamTotal > 0) boxes.push({ n: selamTotal, label: `👋 ${tx.selam}` });
  if ((totals?.reactGot ?? 0) > 0) boxes.push({ n: totals!.reactGot, label: `💬 ${tx.react}` });
  if (showBadges && badgeCount > 0) boxes.push({ n: badgeCount, label: `🏅 ${tx.badges} ›`, onPress: () => setBadgesOpen(true) });

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{ paddingTop: topInset + 12, paddingHorizontal: 16, paddingBottom: bottomSpace + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{tx.title}</Text>

        <View style={styles.sum}>
          <View style={styles.sumHead}>
            <Text style={styles.sumKicker}>{tx.since}</Text>
            <Text style={styles.sumDays}>{tx.days(daysHere)}</Text>
          </View>
          {boxes.length ? (
            <View style={styles.boxes}>
              {boxes.map((b) => (
                <Pressable
                  key={b.label}
                  onPress={b.onPress}
                  disabled={!b.onPress}
                  style={({ pressed }) => [styles.box, pressed && b.onPress ? { opacity: 0.8 } : null]}
                  accessibilityRole={b.onPress ? 'button' : undefined}
                >
                  <Text style={styles.boxN}>{b.n.toLocaleString((lang as string) === 'tr' ? 'tr-TR' : 'en-US')}</Text>
                  <Text style={styles.boxL} numberOfLines={1}>
                    {b.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : showBadges ? (
            <Pressable onPress={() => setBadgesOpen(true)} style={[styles.box, { marginTop: 10 }]} accessibilityRole="button">
              <Text style={styles.boxL}>🏅 {tx.badges} ›</Text>
            </Pressable>
          ) : null}
        </View>

        {days === null ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={BRAND} />
        ) : feed.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 48 }}>📭</Text>
            <Text style={styles.emptyTitle}>{tx.emptyTitle}</Text>
            <Text style={styles.emptyBody}>{failed ? tx.error : tx.emptyBody}</Text>
            {!failed ? (
              <Pressable onPress={onOpenNow} style={styles.emptyBtn} accessibilityRole="button">
                <Text style={styles.emptyBtnText}>{tx.emptyBtn}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          feed.map((d) => (
            <View key={d.day}>
              <Text style={styles.day}>{dayName(d.day)}</Text>
              {d.cards.map((c) => {
                const asks = c.asks.filter((a) => findReaction(c.activity, a.key));
                const reacts = c.reacts.map((k) => findReaction(c.activity, k)?.emoji).filter(Boolean);
                const mine = c.mine.filter((m) => findReaction(c.activity, m.key));
                if (!asks.length && !reacts.length && !mine.length) return null;
                return (
                  <View key={c.activity} style={styles.card}>
                    <Text style={styles.cardHead} numberOfLines={1}>
                      {activityName(c.activity, lang)}
                      <Text style={styles.cardHeadSoft}>{`  · ${tx.fromSame}`}</Text>
                    </Text>
                    {asks.map((a) => {
                      const r = findReaction(c.activity, a.key)!;
                      const id = `${d.day}:${c.activity}:${a.key}`;
                      const chosen = a.reply ? r.replies?.find((o) => o.key === a.reply) : null;
                      return (
                        <View key={a.key} style={{ marginTop: 6 }}>
                          <Text style={styles.line}>
                            {r.emoji} {label(r, lang)}
                            {chosen ? (
                              <Text style={styles.answered}>{`  ${tx.answered} ${label(chosen, lang)}`}</Text>
                            ) : (
                              <Text style={styles.soft}>{`  · ${tx.askThem}`}</Text>
                            )}
                          </Text>
                          {!chosen && r.replies ? (
                            <View style={styles.chips}>
                              {r.replies.map((o: CatOption) => (
                                <Pressable
                                  key={o.key}
                                  onPress={() => answer(d.day, c.activity, a.key, o.key)}
                                  disabled={busy !== null}
                                  style={({ pressed }) => [styles.chip, pressed && { opacity: 0.8 }]}
                                  accessibilityRole="button"
                                >
                                  {busy === id ? (
                                    <ActivityIndicator size="small" color={NAVY} />
                                  ) : (
                                    <Text style={styles.chipText}>{label(o, lang)}</Text>
                                  )}
                                </Pressable>
                              ))}
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                    {reacts.length ? <Text style={styles.emojis}>{reacts.join('  ')}</Text> : null}
                    {mine.map((m) => {
                      const r = findReaction(c.activity, m.key)!;
                      return (
                        <View key={`m${m.key}`} style={styles.mine}>
                          <Text style={styles.line}>
                            <Text style={styles.soft}>{`${tx.yourQ}: `}</Text>
                            {r.emoji} {label(r, lang)}
                          </Text>
                          {m.replies.length ? (
                            m.replies.map((x) => {
                              const o = r.replies?.find((y) => y.key === x.key);
                              if (!o) return null;
                              return (
                                <View key={x.key} style={styles.barRow}>
                                  <Text style={styles.barLabel} numberOfLines={1}>
                                    {label(o, lang)}
                                  </Text>
                                  <View style={styles.barTrack}>
                                    <View style={[styles.barFill, { width: `${Math.max(4, Math.min(100, x.pct))}%` }]} />
                                  </View>
                                </View>
                              );
                            })
                          ) : (
                            <Text style={[styles.soft, { marginTop: 4 }]}>{tx.waiting}</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                );
              })}
              {d.selam || badgeDays[d.day]?.length ? (
                <View style={styles.card}>
                  {d.selam ? <Text style={styles.line}>{tx.selamGot}</Text> : null}
                  {(badgeDays[d.day] ?? []).map((id) => (
                    <Pressable key={id} onPress={showBadges ? () => setBadgesOpen(true) : undefined} accessibilityRole="button">
                      <Text style={[styles.line, d.selam && { marginTop: 4 }]}>{tx.newBadge(badgeName(id, lang))}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ))
        )}

        {more ? (
          <Pressable onPress={loadOlder} style={styles.olderBtn} accessibilityRole="button">
            {loadingMore ? <ActivityIndicator color={BRAND} /> : <Text style={styles.olderText}>{tx.older}</Text>}
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function addDays(day: string, n: number): string {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const styles = StyleSheet.create({
  title: { fontFamily: F.bold, fontSize: 28, letterSpacing: -0.6, color: NAVY, marginBottom: 12 },
  sum: { backgroundColor: NAVY, borderRadius: 22, padding: 14 },
  sumHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sumKicker: { fontFamily: F.bold, fontSize: 12, letterSpacing: 0.8, color: PEACH },
  sumDays: { fontFamily: F.medium, fontSize: 12.5, color: '#B8C0D8' },
  boxes: { flexDirection: 'row', gap: 8, marginTop: 10 },
  box: { flex: 1, backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 11 },
  boxN: { fontFamily: F.bold, fontSize: 20, color: '#ffffff' },
  boxL: { fontFamily: F.medium, fontSize: 12, color: '#C9D0E4', marginTop: 2 },
  day: { fontFamily: F.bold, fontSize: 14, color: NAVY, marginTop: 18, marginBottom: 8, marginLeft: 2 },
  card: { backgroundColor: '#ffffff', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 },
  cardHead: { fontFamily: F.bold, fontSize: 14, color: NAVY },
  cardHeadSoft: { fontFamily: F.medium, fontSize: 12, color: '#8A8FA3' },
  line: { fontFamily: F.medium, fontSize: 14.5, color: NAVY, lineHeight: 20 },
  soft: { fontFamily: F.medium, fontSize: 12.5, color: '#7A7F94' },
  answered: { fontFamily: F.bold, fontSize: 13.5, color: BRAND },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: '#D9DCE8',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    minHeight: 34,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  chipText: { fontFamily: F.bold, fontSize: 13.5, color: NAVY },
  emojis: { fontSize: 20, marginTop: 8, letterSpacing: 1 },
  mine: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEF0F6' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  barLabel: { fontFamily: F.bold, fontSize: 12.5, color: NAVY, width: 112 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#E7E9F1', overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: BRAND },
  empty: { alignItems: 'center', marginTop: 48, paddingHorizontal: 12 },
  emptyTitle: { fontFamily: F.bold, fontSize: 18, color: NAVY, marginTop: 8 },
  emptyBody: { fontFamily: F.medium, fontSize: 14, color: '#7A7F94', textAlign: 'center', lineHeight: 20, marginTop: 6 },
  emptyBtn: { backgroundColor: BRAND, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 18, marginTop: 14 },
  emptyBtnText: { fontFamily: F.bold, fontSize: 15, color: '#ffffff' },
  olderBtn: { alignSelf: 'center', marginTop: 10, paddingVertical: 10, paddingHorizontal: 18 },
  olderText: { fontFamily: F.bold, fontSize: 14, color: BRAND },
});

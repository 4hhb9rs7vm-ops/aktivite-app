// Alt bant · Rozetler sekmesi
// Üstte lacivert başlık: üyelik rozetin, serin, canın ve bir sonraki hedef.
// İki bölüm: "30 günlük yol" (Candy Crush tarzı harita, aşağıdan yukarı) ve "Rozetlerim".
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import type { Lang } from '@/lib/i18n';
import { dayLabel, fetchPollHistory, onPollsChanged } from '@/lib/dailyQuestion';
import {
  BADGE_BY_ID,
  BADGES,
  badgeName,
  checkBadges,
  getProgress,
  onBadgesChanged,
  PathDay,
  Progress,
  readEarned,
  TierId,
} from '@/lib/badges';
import { receivedSelamTotal, sentSelamTotal, SELAM_MIN } from '@/lib/selam';
import { track } from '@/lib/analytics';

const NAVY = '#0F2A52';
const AMBER = '#FBBF24';
const AMBER_BG = '#FFF3E4';
const AMBER_FG = '#B45309';
const ROAD = '#E9DFCC';
const INK = '#16161a';
const SOFT = '#5b5b66';
const F = { medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' };

const MILESTONES: Record<number, TierId> = { 7: 'tier_7', 14: 'tier_14', 21: 'tier_21', 30: 'tier_30' };

const TEXT = {
  tr: {
    title: 'Rozetler',
    kicker: '30 GÜN 30 SORU',
    noTier: 'Yeni üye',
    streak: (n: number) => `${n} gün seri`,
    cans: (n: number) => `${n} can`,
    next: (name: string, n: number) => `${name} için ${n} gün kaldı`,
    allDone: 'Tüm üyelikleri topladın 👑',
    notStarted: "Yol 1 Kasım'da başlıyor",
    segPath: '30 günlük yol',
    segBadges: 'Rozetlerim',
    dayN: (n: number) => `${n}. gün`,
    soon: 'yeni seri yakında',
    today: 'Bugün · Cevapla',
    todayDone: 'Bugün ✓',
    joker: 'Canla kurtarıldı',
    received: (n: string) => `Bugüne kadar ${n} selam aldın 👋`,
    sent: (n: number) => `${n} selam verdin`,
    receivedShort: (n: string, s: number) => `${n} selam aldın · ${s} verdin`,
    sentWait: (s: number) => `${s} selam verdin · aldıkların 21:00'de`,
    count: (a: number, b: number) => `${a} / ${b} rozet`,
    earned: 'Kazanıldı',
    canInfo: 'Her hafta 1 can: bir günü kaçırırsan serin bozulmaz.',
  },
  en: {
    title: 'Badges',
    kicker: '30 DAYS 30 QUESTIONS',
    noTier: 'New member',
    streak: (n: number) => `${n}-day streak`,
    cans: (n: number) => `${n} life`,
    next: (name: string, n: number) => `${n} days to ${name}`,
    allDone: 'You collected every membership 👑',
    notStarted: 'The road starts on November 1',
    segPath: '30-day road',
    segBadges: 'My badges',
    dayN: (n: number) => `Day ${n}`,
    soon: 'new series soon',
    today: 'Today · Answer',
    todayDone: 'Today ✓',
    joker: 'Saved by a life',
    received: (n: string) => `You've received ${n} hellos 👋`,
    sent: (n: number) => `You sent ${n} hellos`,
    receivedShort: (n: string, s: number) => `${n} received · ${s} sent`,
    sentWait: (s: number) => `${s} sent · yours arrive at 9 pm`,
    count: (a: number, b: number) => `${a} / ${b} badges`,
    earned: 'Earned',
    canInfo: "1 life per week: miss a day and your streak survives.",
  },
};

// Yol çizimi
const STEP = 50; // kısa yol: 1-7. gün tek ekranda
const GRID_GAP = 8; // duraklar arası dikey mesafe
const PAD_TOP = 60;
const PAD_BOTTOM = 44;
const TEASER = 2; // son duraktan sonra "devamı yakında" için ayrılan durak sayısı

function roadHeight(total: number) {
  return PAD_TOP + PAD_BOTTOM + (total - 1 + TEASER) * STEP;
}

function nodePos(n: number, width: number, total: number) {
  const ROAD_H = roadHeight(total);
  const amp = Math.min(84, width / 2 - 56);
  const x = width / 2 + amp * Math.sin((n - 1) * 0.9);
  const y = ROAD_H - PAD_BOTTOM - (n - 1) * STEP; // 1. gün en altta
  return { x, y };
}

type Props = {
  lang: Lang;
  topInset: number;
  bottomSpace: number;
  onOpenPolls: () => void;
};

export function BadgesTab({ lang, topInset, bottomSpace, onOpenPolls }: Props) {
  const tx = (lang as string) === 'tr' ? TEXT.tr : TEXT.en;
  const [seg, setSeg] = useState<'path' | 'badges'>('path');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [earned, setEarned] = useState<Record<string, string>>({});
  const [received, setReceived] = useState(0);
  const [sent, setSent] = useState(0);
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const pathTop = useRef(0);
  const viewH = useRef(500);
  const scrolledOnce = useRef(false);

  const load = useCallback(async () => {
    try {
      await fetchPollHistory(lang).catch(() => []); // sunucudaki cevapları telefona eşitle (yeniden kurulumda)
      await checkBadges().catch(() => []);
      const [p, e, r, s] = await Promise.all([getProgress(), readEarned(), receivedSelamTotal(), sentSelamTotal()]);
      setProgress(p);
      setEarned(e);
      setReceived(r);
      setSent(s);
    } catch {}
  }, [lang]);

  useEffect(() => {
    track('badges_tab_open');
    load();
    const offB = onBadgesChanged(load);
    const offP = onPollsChanged(load);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') load();
    });
    return () => {
      offB();
      offP();
      sub.remove();
    };
  }, [load]);

  // Sekme değişince yol tekrar bugüne kaysın
  useEffect(() => {
    if (seg === 'path') scrolledOnce.current = false;
  }, [seg]);

  // Yol açılınca bugüne kaydır
  useEffect(() => {
    if (seg !== 'path' || !progress || !width || scrolledOnce.current) return;
    const todayN = progress.days.filter((d) => d.status !== 'locked').length || 1;
    // Bugün ile bir sonraki rozet durağı birlikte görünsün
    const nextMs = [7, 14, 21, 30].find((n) => n > todayN) ?? todayN;
    const total = progress.days.length;
    const todayY = nodePos(todayN, width, total).y;
    const y = (todayY + nodePos(nextMs, width, total).y) / 2;
    scrolledOnce.current = true;
    setTimeout(() => {
      // Alt bandın arkası görünmez: görünür alan = kaydırma alanı - alt boşluk
      const visible = Math.max(200, viewH.current - bottomSpace);
      let target = pathTop.current + y - visible / 2;
      // Bugünün durağı (etiketiyle) alt bandın arkasında kalmasın
      const todayAbs = pathTop.current + todayY;
      if (todayAbs + 70 > target + visible) target = todayAbs + 70 - visible;
      scrollRef.current?.scrollTo({ y: Math.max(0, target), animated: false });
    }, 80);
  }, [seg, progress, width]);

  const tierId = progress?.tier ?? null;
  const tierLabel = tierId ? `${BADGE_BY_ID[tierId].emoji} ${badgeName(tierId, lang)}` : `🌱 ${tx.noTier}`;
  const nextLine = !progress
    ? ''
    : !progress.started
      ? tx.notStarted
      : progress.next
        ? tx.next(badgeName(progress.next.id, lang), progress.next.left)
        : tierId === 'tier_30'
          ? tx.allDone
          : '';
  const earnedCount = BADGES.filter((b) => earned[b.id]).length;

  function renderNode(d: PathDay) {
    const { x, y } = nodePos(d.n, width, progress!.days.length);
    const ms = MILESTONES[d.n];
    if (ms && d.status !== 'today') {
      const got = !!earned[ms];
      const reached = d.status === 'answered' || d.status === 'joker';
      return (
        <View key={d.n}>
          <View
            style={[
              styles.milestone,
              { left: x - 26, top: y - 26 },
              got ? styles.milestoneGot : reached ? styles.milestoneReached : styles.milestoneLocked,
            ]}
          >
            <Text style={[styles.milestoneEmoji, !got && { opacity: 0.55 }]}>{BADGE_BY_ID[ms].emoji}</Text>
          </View>
          <View style={[styles.msLabel, x > width / 2 ? { right: width - x + 32 } : { left: x + 32 }, { top: y - 12 }]}>
            <Text style={styles.msLabelText}>
              {d.n}. {badgeName(ms, lang)}
            </Text>
          </View>
        </View>
      );
    }
    if (d.status === 'today') {
      return (
        <Pressable
          key={d.n}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onOpenPolls();
          }}
          style={[styles.todayNode, { left: x - 26, top: y - 26 }]}
          accessibilityRole="button"
        >
          <Text style={styles.todayNum}>{d.n}</Text>
          <View style={styles.todayTag}>
            <Text style={styles.todayTagText}>{tx.today}</Text>
          </View>
        </Pressable>
      );
    }
    if (d.status === 'answered') {
      return (
        <View key={d.n} style={[styles.node, styles.nodeDone, { left: x - 20, top: y - 20 }]}>
          <Text style={styles.nodeDoneText}>✓</Text>
        </View>
      );
    }
    if (d.status === 'joker') {
      return (
        <View key={d.n} style={[styles.node, styles.nodeJoker, { left: x - 20, top: y - 20 }]}>
          <Text style={{ fontSize: 18 }}>🛟</Text>
        </View>
      );
    }
    if (d.status === 'missed') {
      return (
        <View key={d.n} style={[styles.node, styles.nodeMissed, { left: x - 20, top: y - 20 }]}>
          <Text style={styles.nodeMissedText}>{d.n}</Text>
        </View>
      );
    }
    return (
      <View key={d.n} style={[styles.node, styles.nodeLocked, { left: x - 20, top: y - 20 }]}>
        <Text style={styles.nodeLockedText}>{d.n}</Text>
      </View>
    );
  }

  function renderRoad() {
    if (!progress || !width) return <View style={{ height: roadHeight(30) }} />;
    const total = progress.days.length;
    const ROAD_H = roadHeight(total);
    const all = progress.days.map((d) => nodePos(d.n, width, total));
    // Son duraktan sonra noktalı devam: "bitmeyen yol"
    const teaser: { x: number; y: number }[] = [];
    for (let k = 0; k <= 12; k++) teaser.push(nodePos(total + (k / 12) * 1.4, width, total));
    const nextPos = nodePos(total + 1.75, width, total);
    const lastDate = progress.days[total - 1]?.date;
    const nextDate = lastDate
      ? new Date(Date.UTC(+lastDate.slice(0, 4), +lastDate.slice(5, 7) - 1, +lastDate.slice(8, 10) + 1))
          .toISOString()
          .slice(0, 10)
      : null;
    const toPath = (pts: { x: number; y: number }[]) =>
      pts.length ? 'M' + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L') : '';
    const doneUpTo = progress.days.filter((d) => d.status !== 'locked').length;
    const done = all.slice(0, Math.max(0, doneUpTo));
    return (
      <View style={{ height: ROAD_H }}>
        <Svg width={width} height={ROAD_H} style={StyleSheet.absoluteFill}>
          <Path d={toPath(all)} stroke={ROAD} strokeWidth={13} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {done.length > 1 ? (
            <Path d={toPath(done)} stroke={AMBER} strokeWidth={13} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
          <Path
            d={toPath(teaser)}
            stroke={ROAD}
            strokeWidth={10}
            strokeDasharray="0.1 22"
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
        {progress.days.map(renderNode)}
        {nextDate ? (
          <View style={[styles.soon, { top: nextPos.y - 18 }]}>
            <Text style={styles.soonText}>
              {dayLabel(nextDate, lang)} · {tx.soon}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  function renderBadges() {
    const loc = (lang as string) === 'tr' ? 'tr-TR' : 'en-US';
    const selamLine =
      received >= SELAM_MIN
        ? tx.receivedShort(received.toLocaleString(loc), sent)
        : sent > 0
          ? tx.sentWait(sent)
          : '';
    // 3 sütun, 9 rozet tek ekrana sığsın: hücre genişliği ekrandan hesaplanır
    const cellW = width ? Math.floor((width - 32 - 2 * GRID_GAP) / 3) : 100;
    return (
      <View style={styles.badgesWrap}>
        <View style={styles.badgesTop}>
          <Text style={styles.badgesCount}>{tx.count(earnedCount, BADGES.length)}</Text>
          {selamLine ? (
            <Text style={styles.selamLine} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              👋 {selamLine}
            </Text>
          ) : null}
        </View>
        <View style={styles.grid}>
          {BADGES.map((b) => {
            const got = !!earned[b.id];
            const tr = (lang as string) === 'tr';
            return (
              <View key={b.id} style={[styles.cell, { width: cellW }, !got && styles.cellLocked]}>
                <View style={[styles.cellMedal, got ? styles.cellMedalGot : styles.cellMedalLocked]}>
                  <Text style={[styles.cellEmoji, !got && { opacity: 0.35 }]}>{b.emoji}</Text>
                </View>
                <Text
                  style={[styles.cellName, !got && { color: '#9A9EAA' }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {tr ? b.name.tr : b.name.en}
                </Text>
                <Text style={[styles.cellHow, got && { color: AMBER_FG }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {got ? tx.earned : tr ? b.how.tr : b.how.en}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFF9F0' }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: topInset + 12 }]}>
          <Text style={styles.kicker}>{tx.kicker}</Text>
          <Text style={styles.title}>{tx.title}</Text>
          <View style={styles.chips}>
            <View style={[styles.chip, styles.chipTier]}>
              <Text style={styles.chipTierText}>{tierLabel}</Text>
            </View>
            {progress && progress.streak > 0 ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>🔥 {tx.streak(progress.streak)}</Text>
              </View>
            ) : null}
            {progress ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>🛟 {tx.cans(progress.cansLeft)}</Text>
              </View>
            ) : null}
          </View>
          {nextLine ? <Text style={styles.nextLine}>{nextLine}</Text> : null}
      </View>

      <View style={styles.segWrap}>
          <View style={styles.seg}>
            {(['path', 'badges'] as const).map((s) => (
              <Pressable
                key={s}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setSeg(s);
                }}
                style={[styles.segBtn, seg === s && styles.segBtnOn]}
              >
                <Text style={[styles.segText, seg === s && styles.segTextOn]}>
                  {s === 'path' ? tx.segPath : tx.segBadges}
                </Text>
              </Pressable>
            ))}
          </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottomSpace }}
        showsVerticalScrollIndicator={false}
        onLayout={(e) => (viewH.current = e.nativeEvent.layout.height)}
      >
        {seg === 'path' ? (
          <View>
            <Text style={styles.canInfo}>{tx.canInfo}</Text>
            <View onLayout={(e) => (pathTop.current = e.nativeEvent.layout.y)}>{renderRoad()}</View>
          </View>
        ) : (
          renderBadges()
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: NAVY, paddingHorizontal: 20, paddingBottom: 14 },
  kicker: { fontFamily: F.bold, fontSize: 13, letterSpacing: 1.2, color: AMBER },
  title: { marginTop: 2, fontFamily: F.bold, fontSize: 28, letterSpacing: -0.6, color: '#ffffff' },
  chips: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  chipText: { fontFamily: F.bold, fontSize: 13, color: '#ffffff' },
  chipTier: { backgroundColor: AMBER },
  chipTierText: { fontFamily: F.bold, fontSize: 13, color: NAVY },
  nextLine: { marginTop: 8, fontFamily: F.medium, fontSize: 14, color: '#C9D5EE' },
  segWrap: { backgroundColor: '#FFF9F0', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  rewards: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: '#FFF9F0' },
  reward: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#F1E7D6',
    borderStyle: 'dashed',
  },
  rewardGot: { backgroundColor: AMBER, borderColor: AMBER, borderStyle: 'solid' },
  rewardEmoji: { fontSize: 22 },
  rewardDay: { marginTop: 2, fontFamily: F.bold, fontSize: 11, color: AMBER_FG },
  rewardName: { fontFamily: F.bold, fontSize: 11.5, color: '#8A7F6C' },
  seg: { flexDirection: 'row', backgroundColor: '#F1E7D6', borderRadius: 14, padding: 4 },
  segBtn: { flex: 1, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segBtnOn: { backgroundColor: '#ffffff' },
  segText: { fontFamily: F.bold, fontSize: 14, color: '#8A7F6C' },
  segTextOn: { color: NAVY },
  canInfo: { marginTop: 6, marginHorizontal: 20, fontFamily: F.medium, fontSize: 13, color: '#8A7F6C', textAlign: 'center' },
  node: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeDone: { backgroundColor: AMBER },
  nodeDoneText: { fontFamily: F.bold, fontSize: 18, color: NAVY },
  nodeJoker: { backgroundColor: '#E4EAF3' },
  nodeMissed: { backgroundColor: '#F3EEE6', borderWidth: 2, borderColor: '#E0D6C4' },
  nodeMissedText: { fontFamily: F.bold, fontSize: 15, color: '#C2B8A6', textDecorationLine: 'line-through' },
  nodeLocked: { backgroundColor: '#ffffff', borderWidth: 2, borderColor: ROAD },
  nodeLockedText: { fontFamily: F.bold, fontSize: 15, color: '#A0A4B0' },
  todayNode: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: NAVY,
    borderWidth: 4,
    borderColor: AMBER,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AMBER,
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  todayNum: { fontFamily: F.bold, fontSize: 18, color: '#ffffff' },
  todayTag: {
    position: 'absolute',
    top: 54,
    left: -43,
    width: 130,
    alignItems: 'center',
  },
  todayTagText: {
    fontFamily: F.bold,
    fontSize: 12,
    color: NAVY,
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  soon: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  soonText: {
    fontFamily: F.bold,
    fontSize: 13,
    color: '#8A7F6C',
    backgroundColor: '#F1E7D6',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: 'hidden',
  },
  milestone: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneGot: { backgroundColor: AMBER },
  milestoneReached: { backgroundColor: '#FDE7B0' },
  milestoneLocked: { backgroundColor: '#ffffff', borderWidth: 3, borderColor: AMBER, borderStyle: 'dashed' },
  milestoneEmoji: { fontSize: 24 },
  msLabel: { position: 'absolute' },
  msLabelText: {
    fontFamily: F.bold,
    fontSize: 12,
    color: AMBER_FG,
    backgroundColor: AMBER_BG,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  badgesWrap: { paddingHorizontal: 16, paddingTop: 4 },
  badgesTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  badgesCount: { fontFamily: F.bold, fontSize: 15, color: SOFT, marginLeft: 2 },
  selamLine: { flexShrink: 1, fontFamily: F.bold, fontSize: 13, color: AMBER_FG },
  grid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  cell: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  cellLocked: { backgroundColor: '#FBF7F0' },
  cellMedal: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  cellMedalGot: { backgroundColor: AMBER },
  cellMedalLocked: { backgroundColor: '#EFE8DC' },
  cellEmoji: { fontSize: 23 },
  cellName: { marginTop: 6, fontFamily: F.bold, fontSize: 12.5, color: INK, textAlign: 'center' },
  cellHow: { marginTop: 1, fontFamily: F.medium, fontSize: 10.5, color: '#9A9EAA', textAlign: 'center' },
});

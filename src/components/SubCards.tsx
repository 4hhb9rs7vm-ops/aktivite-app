// 1.5.8: Sonuç ekranında oranın altındaki tek kart.
// Sıra: alt soru (cevaplanmadıysa) → yaş kartı → durum kartı → alt sorunun özeti → yaş grubunun özeti.
// Kart hep tek satır yüksekliğinde kalır; dağılımın tamamı "Tümünü gör" ile alttan açılır.
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { activityName, type Lang } from '@/lib/i18n';
import { SEGMENTS, type Segment } from '@/lib/me';
import { setOverlayBusy } from '@/lib/overlay';
import { AGE_POINTS, claimAgeBonus } from '@/lib/prediction';
import {
  answerSub,
  cardAllowed,
  dismissCard,
  fetchAgeToday,
  fetchSubStats,
  subLabel,
  SUBS,
  type AgeToday,
  type SubStats,
} from '@/lib/subs';

const F = { regular: 'DMSans_400Regular', medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' };
const INK = '#16161A';
const MUTED = '#6B6F7B';
const ACCENT = '#3F3BC9';
const PEACH = '#F4B88A';
const KICKER = '#9A5A2C';
const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55+'];

type Bar = { label: string; pct: number; mine?: boolean };

function BarsSheet({
  visible,
  title,
  note,
  bars,
  bottomInset,
  onClose,
}: {
  visible: boolean;
  title: string;
  note: string;
  bars: Bar[];
  bottomInset: number;
  onClose: () => void;
}) {
  useEffect(() => {
    setOverlayBusy('sub_sheet', visible);
    return () => setOverlayBusy('sub_sheet', false);
  }, [visible]);
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={st.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Kapat" />
        <View style={[st.sheet, { paddingBottom: Math.max(bottomInset, 16) + 14 }]}>
          <View style={st.handle} />
          <Text style={st.sheetTitle}>{title}</Text>
          <Text style={st.sheetNote}>{note}</Text>
          {bars.map((b) => (
            <View key={b.label} style={st.barRow}>
              <Text style={st.barLabel} numberOfLines={2}>
                {b.label}
              </Text>
              <View style={st.barTrack}>
                <View style={[st.barFill, { width: `${Math.max(3, Math.min(100, b.pct))}%` }, b.mine && { backgroundColor: PEACH }]} />
              </View>
              <Text style={st.barPct}>%{b.pct}</Text>
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
}

function ChipsCard({
  kicker,
  title,
  options,
  note,
  onPick,
  onDismiss,
}: {
  kicker: string;
  title: string;
  options: { key: string; label: string }[];
  note?: string;
  onPick: (key: string) => void;
  onDismiss?: () => void;
}) {
  // Şıklar ekrana sığmıyorsa sağda küçük bir ok görünür; sona kaydırılınca kaybolur
  const [boxW, setBoxW] = useState(0);
  const [contentW, setContentW] = useState(0);
  const [x, setX] = useState(0);
  const hasMore = boxW > 0 && contentW > boxW + 4 && x < contentW - boxW - 8;
  return (
    <View style={st.card}>
      <View style={st.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={st.kicker}>{kicker}</Text>
          <Text style={st.title}>{title}</Text>
        </View>
        {onDismiss ? (
          <Pressable onPress={onDismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Kapat">
            <Text style={st.close}>✕</Text>
          </Pressable>
        ) : null}
      </View>
      <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.chips}
        keyboardShouldPersistTaps="handled"
        onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}
        onContentSizeChange={(w) => setContentW(w)}
        onScroll={(e) => setX(e.nativeEvent.contentOffset.x)}
        scrollEventThrottle={32}
      >
        {options.map((o) => (
          <Pressable
            key={o.key}
            style={({ pressed }) => [st.chip, pressed && { backgroundColor: '#EEF0FF', borderColor: ACCENT }]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onPick(o.key);
            }}
            accessibilityRole="button"
          >
            <Text style={st.chipText}>{o.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {hasMore ? (
        <View style={st.moreHint} pointerEvents="none">
          <Text style={st.moreHintText}>›</Text>
        </View>
      ) : null}
      </View>
      {note ? <Text style={st.note}>{note}</Text> : null}
    </View>
  );
}

function SummaryCard({ kicker, text, more, onMore }: { kicker: string; text: string; more?: string; onMore?: () => void }) {
  return (
    <Pressable style={[st.card, st.summary]} onPress={onMore} disabled={!onMore} accessibilityRole={onMore ? 'button' : undefined}>
      <View style={{ flex: 1 }}>
        <Text style={st.kicker}>{kicker}</Text>
        <Text style={st.summaryText} numberOfLines={2}>
          {text}
        </Text>
      </View>
      {onMore && more ? <Text style={st.more}>{more} ›</Text> : null}
    </Pressable>
  );
}

// Cevap verildi ama oran için henüz yeterli kişi yok: ince tek satır
function PendingLine({ picked, text }: { picked: string; text: string }) {
  return (
    <View style={[st.card, st.pending]}>
      <Text style={st.pendingPick} numberOfLines={1}>
        ✓ {picked}
      </Text>
      <Text style={st.pendingText} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

export function ResultExtraCard({
  activityId,
  lang,
  age,
  segment,
  bottomInset,
  onAge,
  onSegment,
  onSubAnswered,
}: {
  onSubAnswered?: () => void; // 1.6.0: kaydırılabilir kartta sıradaki karta geçmek için
  activityId: string;
  lang: Lang;
  age: string | undefined;
  segment: Segment | null;
  bottomInset: number;
  onAge: (age: string) => void;
  onSegment: (seg: Segment) => void;
}) {
  const T = (lang as string) === 'tr';
  const sub = SUBS[activityId];
  const [stats, setStats] = useState<SubStats | null>(null);
  const [subLoaded, setSubLoaded] = useState(false);
  const [ageToday, setAgeToday] = useState<AgeToday | null>(null);
  const [ageOk, setAgeOk] = useState(false);
  const [segOk, setSegOk] = useState(false);
  const [bonus, setBonus] = useState(false);
  const [sheet, setSheet] = useState<'sub' | 'age' | null>(null);

  useEffect(() => {
    let alive = true;
    setStats(null);
    setSubLoaded(false);
    if (!sub) {
      setSubLoaded(true);
      return;
    }
    fetchSubStats(activityId)
      .then((s) => {
        if (!alive) return;
        setStats(s);
        setSubLoaded(true);
      })
      .catch(() => alive && setSubLoaded(true));
    return () => {
      alive = false;
    };
  }, [activityId, sub]);

  useEffect(() => {
    let alive = true;
    cardAllowed('age').then((ok) => alive && setAgeOk(ok)).catch(() => {});
    cardAllowed('segment').then((ok) => alive && setSegOk(ok)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setAgeToday(null);
    if (!age) return;
    fetchAgeToday(age)
      .then((a) => alive && setAgeToday(a))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [age, activityId]);

  if (!subLoaded) return null;

  async function pickSub(key: string) {
    // Önce ekranda göster, sonra sunucudan gelen gerçek dağılımla güncelle
    setStats((prev) => ({ total: (prev?.total ?? 0) + 1, mine: key, rows: null }));
    onSubAnswered?.();
    const s = await answerSub(activityId, key);
    if (s) setStats(s);
  }

  function pickAge(a: string) {
    onAge(a);
    claimAgeBonus()
      .then((ok) => ok && setBonus(true))
      .catch(() => {});
  }

  // 1) Alt soru (bugün bu aktivite için cevaplanmadıysa)
  if (sub && stats && !stats.mine) {
    return (
      <ChipsCard
        kicker={T ? 'BİR SORU DAHA · İSTEĞE BAĞLI' : 'ONE MORE QUESTION · OPTIONAL'}
        title={T ? sub.q.tr : sub.q.en}
        options={sub.options.map((o) => ({ key: o.key, label: T ? o.tr : o.en }))}
        onPick={pickSub}
      />
    );
  }

  // 2) Yaş kartı
  if (!age && ageOk) {
    return (
      <ChipsCard
        kicker={T ? 'SENİN YAŞINDAKİLER NE YAPIYOR?' : 'WHAT ARE PEOPLE YOUR AGE DOING?'}
        title={T ? 'Yaş aralığını seç' : 'Pick your age range'}
        options={AGE_RANGES.map((a) => ({ key: a, label: a }))}
        note={T ? `+${AGE_POINTS} puan · yalnızca toplamlarda, anonim kullanılır` : `+${AGE_POINTS} points · used anonymously, in totals only`}
        onPick={pickAge}
        onDismiss={() => {
          dismissCard('age').catch(() => {});
          setAgeOk(false);
        }}
      />
    );
  }

  // 3) Durum kartı (hoş geldin ekranını görmemiş mevcut kullanıcılar için)
  if (!segment && segOk) {
    return (
      <ChipsCard
        kicker={T ? 'SENİ TANIYALIM' : "LET'S GET TO KNOW YOU"}
        title={T ? 'Sen hangisisin?' : 'Which one are you?'}
        options={SEGMENTS.map((o) => ({ key: o.id, label: `${o.emoji} ${T ? o.tr : o.en}` }))}
        onPick={(k) => onSegment(k as Segment)}
        onDismiss={() => {
          dismissCard('segment').catch(() => {});
          setSegOk(false);
        }}
      />
    );
  }

  // 4) Alt sorunun özeti
  if (sub && stats?.mine) {
    const rows = stats.rows;
    const top = rows && rows.length ? rows[0] : null;
    const group = T ? sub.group.tr : sub.group.en;
    if (!top) {
      return (
        <PendingLine
          picked={subLabel(activityId, stats.mine, lang)}
          text={T ? 'Yeterince kişi cevaplayınca oranları burada görürsün' : "You'll see the breakdown here once enough people answer"}
        />
      );
    }
    return (
      <>
        <SummaryCard
          kicker={group.toLocaleUpperCase(T ? 'tr-TR' : 'en-US')}
          text={
            T ? `%${top.pct}: ${subLabel(activityId, top.key, lang)}` : `${top.pct}%: ${subLabel(activityId, top.key, lang)}`
          }
          more={T ? 'Tümünü gör' : 'See all'}
          onMore={rows ? () => setSheet('sub') : undefined}
        />
        <BarsSheet
          visible={sheet === 'sub' && !!rows}
          title={group}
          note={
            T
              ? `Yalnızca bu aktiviteyi seçenlerin kendi içinde · bugün ${stats.total} kişi`
              : `Among people who picked this activity only · ${stats.total} today`
          }
          bars={(rows ?? []).map((r) => ({ label: subLabel(activityId, r.key, lang), pct: r.pct, mine: r.key === stats.mine }))}
          bottomInset={bottomInset}
          onClose={() => setSheet(null)}
        />
      </>
    );
  }

  // 5) Yaş grubunun bugünkü özeti
  if (age && ageToday?.rows && ageToday.rows.length) {
    const top = ageToday.rows[0];
    const own = ageToday.scope === 'age';
    const kicker = own ? (T ? `${age} YAŞ · BUGÜN` : `AGE ${age} · TODAY`) : T ? 'BUGÜN HERKES' : 'EVERYONE TODAY';
    return (
      <>
        <SummaryCard
          kicker={bonus ? `${kicker} · +${AGE_POINTS} ${T ? 'PUAN' : 'POINTS'}` : kicker}
          text={T ? `En çok: ${activityName(top.activity, lang)} · %${top.pct}` : `Top: ${activityName(top.activity, lang)} · ${top.pct}%`}
          more={T ? 'Tümünü gör' : 'See all'}
          onMore={() => setSheet('age')}
        />
        <BarsSheet
          visible={sheet === 'age'}
          title={own ? (T ? `${age} yaş bugün ne yaptı?` : `What did age ${age} do today?`) : T ? 'Bugün herkes ne yaptı?' : 'What did everyone do today?'}
          note={
            own
              ? T
                ? `Günün toplamı · ${ageToday.people} kişi`
                : `Today's total · ${ageToday.people} people`
              : T
                ? 'Yaş grubunda henüz yeterli kişi yok; grubun büyüdükçe burası sana özel olacak.'
                : 'Not enough people in your age group yet; this becomes yours as the group grows.'
          }
          bars={ageToday.rows.map((r) => ({ label: activityName(r.activity, lang), pct: r.pct, mine: r.activity === activityId }))}
          bottomInset={bottomInset}
          onClose={() => setSheet(null)}
        />
      </>
    );
  }

  return null;
}

const st = StyleSheet.create({
  card: { backgroundColor: '#ffffff', borderRadius: 20, paddingVertical: 12, paddingLeft: 14, marginTop: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', paddingRight: 14 },
  kicker: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.8, color: KICKER },
  title: { fontFamily: F.bold, fontSize: 16, color: INK, marginTop: 3 },
  close: { fontFamily: F.bold, fontSize: 15, color: '#A0A4B2', paddingLeft: 10 },
  chips: { gap: 8, paddingRight: 14, paddingTop: 9 },
  chip: { borderWidth: 1.5, borderColor: '#D9DCE8', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13, backgroundColor: '#ffffff' },
  chipText: { fontFamily: F.medium, fontSize: 14, color: INK },
  note: { fontFamily: F.regular, fontSize: 12, color: MUTED, marginTop: 8, paddingRight: 14 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 14 },
  summaryText: { fontFamily: F.bold, fontSize: 15.5, lineHeight: 21, color: INK, marginTop: 2 },
  more: { fontFamily: F.bold, fontSize: 13.5, color: ACCENT },
  moreHint: {
    position: 'absolute',
    right: 0,
    top: 9,
    bottom: 0,
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  moreHintText: { fontFamily: F.bold, fontSize: 22, lineHeight: 24, color: ACCENT },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingRight: 14, borderRadius: 16 },
  pendingPick: { flexShrink: 0, maxWidth: '45%', fontFamily: F.bold, fontSize: 14, color: INK },
  pendingText: { flex: 1, fontFamily: F.regular, fontSize: 12.5, lineHeight: 16, color: MUTED },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,14,28,0.45)' },
  sheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 10 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#D4D4D8', marginBottom: 16 },
  sheetTitle: { fontFamily: F.bold, fontSize: 19, color: INK },
  sheetNote: { fontFamily: F.regular, fontSize: 13, lineHeight: 18, color: MUTED, marginTop: 4, marginBottom: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  barLabel: { width: 118, fontFamily: F.medium, fontSize: 14, color: INK },
  barTrack: { flex: 1, height: 24, borderRadius: 9, backgroundColor: '#EEF0F6', overflow: 'hidden' },
  barFill: { height: 24, borderRadius: 9, backgroundColor: '#C9CCF5' },
  barPct: { width: 44, textAlign: 'right', fontFamily: F.bold, fontSize: 14, color: INK },
});

// 1.6.0: Tepki kutusu (koyu lacivert, oran kartının hemen altında).
// Yalnızca sunucu açarsa görünür (bugün o aktiviteyi yeterli kişi seçtiyse). Her an seçiminde tek tepki.
// Tepki bırakınca: büyük onay ve "bugün bu anı seçenlerin bıraktığı" oranlar (en az 5 gönderim).
// Soru tepkisi bırakınca: gelen cevapların oranı, ekran açıkken yenilenir. Kişi sayısı gösterilmez.
// Gelenler Mesaj kutusunda (InboxTab).
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import type { Lang } from '@/lib/i18n';
import { reactionsFor, type CatReaction } from '@/lib/catalog';
import {
  fetchAskStatus,
  fetchReactionBox,
  fetchReactionStats,
  sendReaction,
  sentReactionKey,
  type AskStatus,
  type ReactionStats,
} from '@/lib/reactions';

const F = { medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' };
const NAVY = '#0F2A52';
const PEACH = '#F4B88A';
const SOFT = '#C9D0E4';

const TEXT = {
  tr: {
    kicker: 'AYNI ŞEYİ YAPANLARA BİR ŞEY BIRAK',
    kickerMood: 'AYNI DURUMDAKİLERE DESTEK OL',
    pickOne: 'Bir tane seç, anonim gider',
    sentKicker: 'TEPKİN GİTTİ ✓',
    askKicker: 'SORUN GİTTİ ✓',
    wentTo: 'Aynı anı seçenlere gitti',
    askedTo: 'Aynı anı seçenlere soruldu',
    statsHead: 'BUGÜN AYNI ANI SEÇENLERİN BIRAKTIĞI',
    statsWait: 'Birkaç tepki daha gelince burada oranları göreceksin.',
    answersHead: 'GELEN CEVAPLAR · ŞU ANA KADAR',
    answersWait: 'Cevaplar gelince burada ve mesaj kutunda görünecek ✉️',
    answersMore: 'Yeni cevaplar mesaj kutuna da düşer ✉️',
    once: 'Bu an için tepkini bıraktın. Yeni bir an seçince tekrar bırakabilirsin.',
    full: 'Şu an bu anda ulaşacak kimse yok, biraz sonra dene.',
    limit: 'Bu saatlik tepki hakkın doldu.',
    error: 'Gönderilemedi, tekrar dene.',
  },
  en: {
    kicker: 'LEAVE SOMETHING FOR PEOPLE DOING THE SAME',
    kickerMood: 'SUPPORT PEOPLE FEELING THE SAME',
    pickOne: 'Pick one, it goes anonymously',
    sentKicker: 'REACTION SENT ✓',
    askKicker: 'QUESTION SENT ✓',
    wentTo: 'It went to people in the same moment',
    askedTo: 'Asked to people in the same moment',
    statsHead: 'WHAT PEOPLE IN THIS MOMENT LEFT TODAY',
    statsWait: "You'll see the breakdown here after a few more reactions.",
    answersHead: 'ANSWERS SO FAR',
    answersWait: 'Answers will show up here and in your inbox ✉️',
    answersMore: 'New answers land in your inbox too ✉️',
    once: "You've left your reaction for this moment. Pick a new moment to leave another.",
    full: "There's no one to reach in this moment right now, try again a bit later.",
    limit: "You've used this hour's reactions.",
    error: "Couldn't send, try again.",
  },
};

const label = (r: { tr: string; en: string }, lang: Lang) => ((lang as string) === 'tr' ? r.tr : r.en);

export function ReactionBox({
  activityId,
  mood,
  lang,
  onOpen,
  onSent,
}: {
  activityId: string;
  mood?: boolean;
  lang: Lang;
  onOpen?: (open: boolean) => void; // kutu açıldı/kapandı (kart sırası buna göre kurulur)
  onSent?: () => void; // tepki bırakıldı
}) {
  const tx = (lang as string) === 'tr' ? TEXT.tr : TEXT.en;
  const [open, setOpenState] = useState(false);
  const [sent, setSent] = useState<string | null>(null); // bu an seçiminde bırakılan tek tepki
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [stats, setStats] = useState<ReactionStats | null>(null);
  const [ask, setAsk] = useState<AskStatus | null>(null);
  const [askOpen, setAskOpen] = useState(true); // soru tepkisini cevaplayabilecek biri var mı (sunucu)
  const all: CatReaction[] = reactionsFor(activityId);
  // Soru tepkileri yalnızca yeni sürümü kullananlara gider; bugün bu anda öyle biri yoksa soru gösterilmez
  // Soru tepkisi en başta: karşılıklı etkileşimi o başlatıyor
  const list: CatReaction[] = all
    .filter((r) => r.kind !== 'ask' || askOpen || r.key === sent)
    .sort((a, b) => (a.kind === 'ask' ? 0 : 1) - (b.kind === 'ask' ? 0 : 1));
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  const setOpen = useCallback((v: boolean) => {
    setOpenState(v);
    onOpenRef.current?.(v);
  }, []);

  useEffect(() => {
    let alive = true;
    setOpen(false);
    setNote(null);
    setSent(null);
    setStats(null);
    setAsk(null);
    if (!reactionsFor(activityId).length) return;
    Promise.all([fetchReactionBox(activityId), sentReactionKey(activityId)])
      .then(([box, key]) => {
        if (!alive) return;
        setSent(key);
        setAskOpen(box?.ask !== false);
        setOpen(!!box?.open);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [activityId, setOpen]);

  const sentR = sent ? list.find((r) => r.key === sent) ?? null : null;
  const isAsk = sentR?.kind === 'ask';

  // Bırakınca sonuç: tepkide oranlar, soruda gelen cevaplar (ekran açıkken 30 sn'de bir)
  useEffect(() => {
    if (!sentR) return;
    let alive = true;
    const load = () => {
      if (isAsk)
        fetchAskStatus(activityId)
          .then((a) => alive && a && setAsk(a))
          .catch(() => {});
      else
        fetchReactionStats(activityId)
          .then((s) => alive && s && setStats(s))
          .catch(() => {});
    };
    load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [activityId, sentR?.key, isAsk]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onPick(r: CatReaction) {
    if (busy || sent) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setBusy(r.key);
    const res = await sendReaction(activityId, r.key);
    setBusy(null);
    if (res.ok) {
      if (res.sent > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setNote(null);
        setSent(r.key);
        onSent?.();
      } else setNote(tx.full);
    } else if (res.error === 'once') setNote(tx.once);
    else if (res.error === 'limit') setNote(tx.limit);
    else if (res.error === 'closed' || res.error === 'key' || res.error === 'not_picked') setOpen(false);
    else setNote(tx.error);
  }

  if (!open || !list.length) return null;

  // Bırakıldıktan sonra: onay ve sonuç
  if (sentR) {
    const rows = isAsk
      ? (ask?.key === sentR.key ? ask.replies : [])
          .map((x) => ({ text: sentR.replies?.find((o) => o.key === x.key), pct: x.pct }))
          .filter((x) => x.text)
          .map((x) => ({ label: label(x.text!, lang), pct: x.pct }))
      : (stats?.rows ?? [])
          .map((x) => ({ r: list.find((y) => y.key === x.key), pct: x.pct }))
          .filter((x) => x.r)
          .map((x) => ({ label: `${x.r!.emoji} ${label(x.r!, lang)}`, pct: x.pct }));
    return (
      <View style={styles.box}>
        <Text style={styles.kicker}>{isAsk ? tx.askKicker : tx.sentKicker}</Text>
        <View style={styles.doneRow}>
          <View style={styles.doneChip}>
            <Text style={styles.doneChipText} numberOfLines={1}>
              {sentR.emoji} {label(sentR, lang)}
            </Text>
          </View>
          <Text style={styles.doneSub} numberOfLines={2}>
            {isAsk ? tx.askedTo : tx.wentTo}
          </Text>
        </View>
        <View style={styles.result}>
          <Text style={styles.resultHead} numberOfLines={1}>
            {isAsk ? tx.answersHead : tx.statsHead}
          </Text>
          {rows.length ? (
            rows.slice(0, 4).map((x) => (
              <View key={x.label} style={styles.barRow}>
                <Text style={styles.barLabel} numberOfLines={1}>
                  {x.label}
                </Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.max(4, Math.min(100, x.pct))}%` }]} />
                </View>
                <Text style={styles.barPct}>%{x.pct}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.wait}>{isAsk ? tx.answersWait : tx.statsWait}</Text>
          )}
          {isAsk && rows.length ? <Text style={[styles.wait, { marginTop: 8 }]}>{tx.answersMore}</Text> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <Text style={styles.kicker}>{mood ? tx.kickerMood : tx.kicker}</Text>
      <Text style={styles.title}>{tx.pickOne}</Text>
      {/* Çipler alt alta sarılır: hepsi baştan görünür, yarım kalan çip olmaz */}
      <View style={styles.row}>
        {list.map((r) => (
          <Pressable
            key={r.key}
            onPress={() => onPick(r)}
            disabled={!!busy}
            accessibilityRole="button"
            style={({ pressed }) => [styles.chip, r.kind === 'ask' && styles.chipAsk, pressed && { opacity: 0.75 }]}
          >
            {busy === r.key ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={[styles.chipText, r.kind === 'ask' && { color: PEACH }]} numberOfLines={1}>
                {r.emoji} {label(r, lang)}
              </Text>
            )}
          </Pressable>
        ))}
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: NAVY, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 14, marginTop: 12 },
  kicker: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.8, color: PEACH },
  title: { fontFamily: F.bold, fontSize: 17, color: '#ffffff', marginTop: 3 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  chip: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 11,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipAsk: { borderColor: PEACH },
  chipText: { fontFamily: F.bold, fontSize: 13.5, color: '#ffffff' },
  note: { fontFamily: F.medium, fontSize: 12.5, color: SOFT, marginTop: 10 },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 9 },
  doneChip: { backgroundColor: PEACH, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13, flexShrink: 1 },
  doneChipText: { fontFamily: F.bold, fontSize: 14.5, color: NAVY },
  doneSub: { fontFamily: F.medium, fontSize: 13, color: SOFT, flex: 1 },
  result: { marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  resultHead: { fontFamily: F.bold, fontSize: 10.5, letterSpacing: 0.7, color: SOFT },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  barLabel: { fontFamily: F.bold, fontSize: 13, color: '#ffffff', width: 150 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: PEACH },
  barPct: { fontFamily: F.bold, fontSize: 13, color: PEACH, width: 40, textAlign: 'right' },
  wait: { fontFamily: F.medium, fontSize: 12.5, color: SOFT, marginTop: 8, lineHeight: 18 },
});

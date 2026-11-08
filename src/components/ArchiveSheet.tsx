// Kaçırdığın sorular (arşiv): geçmiş Günün Sorusu'nu cevapla, o günün sonucunu gör.
// Arşiv cevapları açıklanmış sonuçları değiştirmez ve seriye sayılmaz.
// 5 arşiv cevabında 🔍 Meraklı Kâşif rozeti.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';

import type { Lang } from '@/lib/i18n';
import { dayLabel } from '@/lib/dailyQuestion';
import { answerArchive, ArchiveItem, fetchArchive } from '@/lib/badges';
import { track } from '@/lib/analytics';

const NAVY = '#0F2A52';
const AMBER = '#FBBF24';
const AMBER_BG = '#FFF3E4';
const AMBER_FG = '#B45309';
const INK = '#16161a';
const SOFT = '#5b5b66';
const F = { regular: 'DMSans_400Regular', medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' };
const EXPLORER_NEED = 5;

const TEXT = {
  tr: {
    title: 'Kaçırdığın sorular',
    lead: 'Cevapla, o günün sonucunu gör. Sonuçları değiştirmez, seriye sayılmaz.',
    day: (n: number) => `GÜN ${n}`,
    fromArchive: 'ARŞİVDEN CEVAPLADIN',
    live: 'O GÜN CEVAPLADIN',
    you: '(sen)',
    noResult: 'Bu günün sonucu yok.',
    empty: 'Kaçırdığın soru yok. Harikasın! 🎉',
    error: 'Sorular yüklenemedi. İnternetini kontrol edip tekrar dene.',
    retry: 'Tekrar dene',
    left: (n: number) => `🔍 ${n} soru daha → Meraklı Kâşif rozeti`,
    done: '🔍 Meraklı Kâşif rozetini kazandın',
    failed: 'Cevap kaydedilemedi. Tekrar dene.',
  },
  en: {
    title: 'Questions you missed',
    lead: "Answer and see that day's result. It doesn't change results or count toward your streak.",
    day: (n: number) => `DAY ${n}`,
    fromArchive: 'ANSWERED FROM THE ARCHIVE',
    live: 'ANSWERED ON THE DAY',
    you: '(you)',
    noResult: 'No result for this day.',
    empty: "You haven't missed any questions. Nice! 🎉",
    error: "Couldn't load the questions. Check your internet and try again.",
    retry: 'Try again',
    left: (n: number) => `🔍 ${n} more → Curious Explorer badge`,
    done: '🔍 You earned the Curious Explorer badge',
    failed: "Couldn't save your answer. Try again.",
  },
};

export function ArchiveSheet({
  visible,
  lang,
  topInset,
  bottomInset,
  onClose,
}: {
  visible: boolean;
  lang: Lang;
  topInset: number;
  bottomInset: number;
  onClose: () => void;
}) {
  const tr = (lang as string) === 'tr';
  const tx = tr ? TEXT.tr : TEXT.en;
  const [items, setItems] = useState<ArchiveItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [errFor, setErrFor] = useState<number | null>(null);

  async function load() {
    setFailed(false);
    const r = await fetchArchive();
    if (!r) {
      setFailed(true);
      return;
    }
    setItems(r);
  }

  useEffect(() => {
    if (visible) {
      setItems(null);
      load();
    }
  }, [visible]);

  async function answer(item: ArchiveItem, key: string) {
    if (busy) return;
    Haptics.selectionAsync().catch(() => {});
    setBusy(item.questionId);
    setErrFor(null);
    const ok = await answerArchive(item, key);
    setBusy(null);
    if (!ok) {
      setErrFor(item.questionId);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    track('archive_answered', { day: item.date });
    setItems((cur) => (cur ?? []).map((x) => (x.questionId === item.questionId ? { ...x, myAnswer: key } : x)));
  }

  const archivedCount = (items ?? []).filter((x) => x.myAnswer && !x.answeredLive).length;
  const leftForBadge = Math.max(0, EXPLORER_NEED - archivedCount);
  // Önce cevaplanmamışlar, sonra arşivden cevaplananlar; o gün cevaplananlar en sonda
  const sorted = [...(items ?? [])].sort((a, b) => {
    const rank = (x: ArchiveItem) => (!x.myAnswer ? 0 : !x.answeredLive ? 1 : 2);
    return rank(a) - rank(b) || (a.date < b.date ? 1 : -1);
  });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { paddingTop: topInset + 8 }]}>
        <View style={styles.head}>
          <Pressable style={styles.back} onPress={onClose} hitSlop={8} accessibilityRole="button">
            <Ionicons name="chevron-down" size={22} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.title}>{tx.title}</Text>
        </View>
        <Text style={styles.lead}>{tx.lead}</Text>

        {items && items.length > 0 ? (
          <View style={styles.badgeHint}>
            <Text style={styles.badgeHintText}>{leftForBadge > 0 ? tx.left(leftForBadge) : tx.done}</Text>
          </View>
        ) : null}

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 + bottomInset, gap: 12 }} showsVerticalScrollIndicator={false}>
          {failed ? (
            <View style={styles.card}>
              <Text style={styles.cardText}>{tx.error}</Text>
              <Pressable style={styles.retry} onPress={load}>
                <Text style={styles.retryText}>{tx.retry}</Text>
              </Pressable>
            </View>
          ) : items === null ? (
            <ActivityIndicator color={AMBER} style={{ marginTop: 40 }} />
          ) : sorted.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardText}>{tx.empty}</Text>
            </View>
          ) : (
            sorted.map((it) => {
              const q = tr ? it.questionTr : it.questionEn || it.questionTr;
              const kicker = `${it.seriesDay ? tx.day(it.seriesDay) : dayLabel(it.date, lang)}${
                it.myAnswer ? ` · ${it.answeredLive ? tx.live : tx.fromArchive}` : ''
              }`;
              return (
                <View key={it.questionId} style={[styles.card, it.answeredLive && { opacity: 0.8 }]}>
                  <Text style={styles.kicker}>{kicker}</Text>
                  <Text style={styles.q}>{q}</Text>
                  {!it.myAnswer ? (
                    <View style={styles.opts}>
                      {it.options.map((o) => (
                        <Pressable
                          key={o.key}
                          style={({ pressed }) => [styles.opt, pressed && { backgroundColor: '#E8EBF2' }]}
                          onPress={() => answer(it, o.key)}
                          disabled={busy !== null}
                          accessibilityRole="button"
                        >
                          {busy === it.questionId ? (
                            <ActivityIndicator size="small" color={NAVY} />
                          ) : (
                            <Text style={styles.optText} numberOfLines={2}>
                              {tr ? o.tr : o.en || o.tr}
                            </Text>
                          )}
                        </Pressable>
                      ))}
                    </View>
                  ) : it.results.length === 0 ? (
                    <Text style={styles.cardText}>{tx.noResult}</Text>
                  ) : (
                    <View style={{ gap: 8, marginTop: 4 }}>
                      {it.options
                        .map((o) => ({ o, pct: it.results.find((r) => r.key === o.key)?.pct ?? 0 }))
                        .sort((a, b) => b.pct - a.pct)
                        .map(({ o, pct }) => {
                          const mine = o.key === it.myAnswer;
                          return (
                            <View key={o.key} style={[styles.bar, mine && styles.barMine]}>
                              <View style={[styles.fill, { width: `${Math.min(100, pct)}%` }, mine && { backgroundColor: AMBER }]} />
                              <Text style={styles.barLabel} numberOfLines={1}>
                                {tr ? o.tr : o.en || o.tr} {mine ? tx.you : ''}
                              </Text>
                              <Text style={styles.barPct}>%{Math.round(pct)}</Text>
                            </View>
                          );
                        })}
                    </View>
                  )}
                  {errFor === it.questionId ? <Text style={styles.err}>{tx.failed}</Text> : null}
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NAVY },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: F.bold, fontSize: 24, letterSpacing: -0.4, color: '#FFFFFF' },
  lead: { fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: '#C9D5EE', paddingHorizontal: 20, marginTop: 10 },
  badgeHint: { marginHorizontal: 20, marginTop: 12, marginBottom: 12, backgroundColor: AMBER_BG, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  badgeHintText: { fontFamily: F.bold, fontSize: 14, color: AMBER_FG },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 16, gap: 6 },
  cardText: { fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: SOFT },
  kicker: { fontFamily: F.bold, fontSize: 12, letterSpacing: 1.1, color: AMBER_FG },
  q: { fontFamily: F.bold, fontSize: 18, lineHeight: 24, color: INK, marginBottom: 4 },
  opts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: { flexGrow: 1, flexBasis: '30%', minHeight: 46, borderRadius: 14, backgroundColor: '#F3F4F8', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 8 },
  optText: { fontFamily: F.bold, fontSize: 14, color: NAVY, textAlign: 'center' },
  bar: { height: 42, borderRadius: 12, backgroundColor: '#EEF0F4', overflow: 'hidden', justifyContent: 'center' },
  barMine: { borderWidth: 2, borderColor: AMBER },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#D5DAE5' },
  barLabel: { fontFamily: F.bold, fontSize: 14, color: NAVY, marginLeft: 12, marginRight: 60 },
  barPct: { position: 'absolute', right: 12, fontFamily: F.bold, fontSize: 14, color: NAVY },
  retry: { alignSelf: 'flex-start', marginTop: 6, backgroundColor: NAVY, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  retryText: { fontFamily: F.bold, fontSize: 14, color: '#FFFFFF' },
  err: { fontFamily: F.medium, fontSize: 13, color: '#C0362C', marginTop: 4 },
});

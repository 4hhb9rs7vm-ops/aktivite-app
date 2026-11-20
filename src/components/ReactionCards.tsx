// 1.6.0: Hazır tepkiler.
// ReactionBox: an ekranında "Aynı şeyi yapanlara bir şey bırak" kutusu. Yalnızca sunucu açarsa görünür
// (bugün o aktiviteyi yeterli kişi seçtiyse). Her an seçiminde tek tepki. Gelenler Mesaj kutusunda (InboxTab).
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import type { Lang } from '@/lib/i18n';
import { reactionsFor, type CatReaction } from '@/lib/catalog';
import { fetchReactionBox, sendReaction, sentReactionKey } from '@/lib/reactions';

const F = { medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' };
const NAVY = '#0F2A52';
const PEACH = '#F4B88A';
const BRAND = '#3F3BC9';

const TEXT = {
  tr: {
    kicker: 'AYNI ŞEYİ YAPANLARA BİR ŞEY BIRAK',
    kickerMood: 'AYNI DURUMDAKİLERE DESTEK OL',
    pickOne: 'Bir tane seç, anonim gider',
    sent: 'Bırakıldı ✓ Aynı şeyi yapanlara gitti',
    sentMood: 'Bırakıldı ✓ Aynı durumdakilere gitti',
    sentAsk: 'Bırakıldı ✓ Cevaplar mesaj kutuna düşecek ✉️',
    once: 'Bu an için tepkini bıraktın. Yeni bir an seçince tekrar bırakabilirsin.',
    full: 'Şu an herkes yeterince tepki aldı, biraz sonra dene.',
    limit: 'Bu saatlik tepki hakkın doldu.',
    error: 'Gönderilemedi, tekrar dene.',
  },
  en: {
    kicker: 'LEAVE SOMETHING FOR PEOPLE DOING THE SAME',
    kickerMood: 'SUPPORT PEOPLE FEELING THE SAME',
    pickOne: 'Pick one, it goes anonymously',
    sent: 'Sent ✓ It went to people doing the same',
    sentMood: 'Sent ✓ It went to people feeling the same',
    sentAsk: 'Sent ✓ Answers will land in your inbox ✉️',
    once: "You've left your reaction for this moment. Pick a new moment to leave another.",
    full: 'Everyone got enough for now, try again a bit later.',
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
  onOpen?: (open: boolean) => void; // kutu açıldı/kapandı (kaydırılabilir kart sayfa sayısını buna göre kurar)
  onSent?: () => void; // tepki bırakıldı (sıradaki karta geçmek için)
}) {
  const tx = (lang as string) === 'tr' ? TEXT.tr : TEXT.en;
  const [open, setOpenState] = useState(false);
  const [sent, setSent] = useState<string | null>(null); // bu an seçiminde bırakılan tek tepki
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [overflow, setOverflow] = useState(false);
  const boxW = useRef(0);
  const list: CatReaction[] = reactionsFor(activityId);
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
    if (!reactionsFor(activityId).length) return;
    Promise.all([fetchReactionBox(activityId), sentReactionKey(activityId)])
      .then(([box, key]) => {
        if (!alive) return;
        setSent(key);
        setOpen(!!box?.open);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [activityId, setOpen]);

  async function onPick(r: CatReaction) {
    if (busy || sent) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setBusy(r.key);
    const res = await sendReaction(activityId, r.key);
    setBusy(null);
    if (res.ok) {
      if (res.sent > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setSent(r.key);
        setNote(r.kind === 'ask' ? tx.sentAsk : mood ? tx.sentMood : tx.sent);
        onSent?.();
      } else setNote(tx.full);
    } else if (res.error === 'once') setNote(tx.once);
    else if (res.error === 'limit') setNote(tx.limit);
    else if (res.error === 'closed' || res.error === 'key' || res.error === 'not_picked') setOpen(false);
    else setNote(tx.error);
  }

  if (!open || !list.length) return null;
  const shown = sent ? list.filter((r) => r.key === sent) : list;
  const sentR = sent ? list.find((r) => r.key === sent) : null;
  return (
    <View style={styles.box} onLayout={(e) => (boxW.current = e.nativeEvent.layout.width)}>
      <Text style={styles.kicker}>{mood ? tx.kickerMood : tx.kicker}</Text>
      {!sent ? <Text style={styles.title}>{tx.pickOne}</Text> : null}
      {/* Tek satır, yana kayar: kartın boyu sabit kalsın */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          contentContainerStyle={styles.row}
          onContentSizeChange={(w) => setOverflow(w > boxW.current - 14)}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            setOverflow(contentOffset.x + layoutMeasurement.width < contentSize.width - 8);
          }}
          scrollEventThrottle={64}
        >
          {shown.map((r) => {
            const done = sent === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => onPick(r)}
                disabled={!!sent || !!busy}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.chip,
                  r.kind === 'ask' && styles.chipAsk,
                  done && styles.chipDone,
                  pressed && { opacity: 0.8 },
                ]}
              >
                {busy === r.key ? (
                  <ActivityIndicator size="small" color={NAVY} />
                ) : (
                  <Text style={[styles.chipText, r.kind === 'ask' && !done && { color: BRAND }]} numberOfLines={1}>
                    {r.emoji} {label(r, lang)}
                    {done ? ' ✓' : ''}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
        {overflow && !sent ? (
          <View style={styles.moreHint} pointerEvents="none">
            <Text style={styles.moreHintText}>›</Text>
          </View>
        ) : null}
      </View>
      {note ? (
        <Text style={styles.note}>{note}</Text>
      ) : sentR ? (
        <Text style={styles.note}>{sentR.kind === 'ask' ? tx.sentAsk : mood ? tx.sentMood : tx.sent}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#ffffff', borderRadius: 20, paddingVertical: 12, paddingLeft: 14, marginTop: 12 },
  kicker: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.8, color: '#9A5A2C', paddingRight: 14 },
  title: { fontFamily: F.bold, fontSize: 16, color: NAVY, marginTop: 3, paddingRight: 14 },
  row: { flexDirection: 'row', gap: 7, marginTop: 9, paddingRight: 14 },
  chip: {
    borderWidth: 1.5,
    borderColor: '#D9DCE8',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 11,
    backgroundColor: '#ffffff',
    minHeight: 36,
    justifyContent: 'center',
  },
  chipAsk: { borderColor: BRAND },
  chipDone: { backgroundColor: PEACH, borderColor: PEACH },
  chipText: { fontFamily: F.bold, fontSize: 13.5, color: NAVY },
  note: { fontFamily: F.medium, fontSize: 12.5, color: '#6B7080', marginTop: 9, paddingRight: 14 },
  moreHint: {
    position: 'absolute',
    right: 0,
    top: 9,
    bottom: 0,
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  moreHintText: { fontFamily: F.bold, fontSize: 20, color: BRAND, marginTop: -2 },
});

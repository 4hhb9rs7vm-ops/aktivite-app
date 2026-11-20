// 1.6.0: An ekranında isteğe bağlı kartlar tek bir kaydırılabilir alanda.
// Sıra sunucudan (cat_settings.slot_reaction_first): varsayılan önce tepki kutusu, sonra alt soru / yaş / özet kartı.
// Biri bitince (tepki bırakıldı ya da alt soru cevaplandı) diğerine kendiliğinden kayar; cevaplamayan parmakla kaydırır.
// Tepki kutusu kapalıysa (bugün az kişi) ya da diğer kart boşsa tek kart görünür, kaydırma yok.
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Lang } from '@/lib/i18n';
import { getCatalog } from '@/lib/catalog';
import { ReactionBox } from '@/components/ReactionCards';

const F = { bold: 'DMSans_700Bold' };
const BRAND = '#4F46E5';

type Props = {
  activityId: string;
  mood: boolean;
  lang: Lang;
  // Alt soru / yaş / özet kartı. onDone: alt soru cevaplanınca çağrılır.
  renderExtra: (onDone: () => void) => ReactNode;
};

export function OptionalSlot({ activityId, mood, lang, renderExtra }: Props) {
  const T = (lang as string) === 'tr';
  const reactionFirst = getCatalog()?.settings.reactionFirst ?? true;
  const [width, setWidth] = useState(0);
  const [reactOpen, setReactOpen] = useState(false);
  const [extraH, setExtraH] = useState(0);
  const [page, setPage] = useState(0);
  const scroll = useRef<ScrollView>(null);

  // Aktivite değişince başa dön
  useEffect(() => {
    setPage(0);
    setReactOpen(false);
    scroll.current?.scrollTo({ x: 0, animated: false });
  }, [activityId]);

  const hasExtra = extraH > 4;
  const both = reactOpen && hasExtra;
  const reactIndex = reactionFirst ? 0 : 1;
  const extraIndex = reactionFirst ? 1 : 0;

  function go(i: number) {
    if (!width) return;
    setPage(i);
    scroll.current?.scrollTo({ x: i * width, animated: true });
  }

  // Tek kart varken sayfalama yok: iki sayfa da çizilir ama boş olan sıfır genişlikte kalır
  const reactPage = (
    <View key="r" style={{ width: reactOpen ? width : 0, overflow: 'hidden' }}>
      <ReactionBox
        activityId={activityId}
        mood={mood}
        lang={lang}
        onOpen={setReactOpen}
        onSent={() => {
          if (both) setTimeout(() => go(extraIndex), 900);
        }}
      />
    </View>
  );
  const extraPage = (
    <View key="e" style={{ width: hasExtra || !reactOpen ? width : 0, overflow: 'hidden' }}>
      <View onLayout={(e) => setExtraH(e.nativeEvent.layout.height)}>
        {renderExtra(() => {
          if (both) setTimeout(() => go(reactIndex), 700);
        })}
      </View>
    </View>
  );

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <ScrollView
          ref={scroll}
          horizontal
          pagingEnabled
          scrollEnabled={both}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {reactionFirst ? [reactPage, extraPage] : [extraPage, reactPage]}
        </ScrollView>
      ) : null}
      {both ? (
        <View style={styles.hint}>
          <View style={styles.dots}>
            {[0, 1].map((i) => (
              <Pressable key={i} onPress={() => go(i)} hitSlop={8} accessibilityRole="button">
                <View style={[styles.dot, page === i && styles.dotOn]} />
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => go(page === 0 ? 1 : 0)} hitSlop={8} accessibilityRole="button">
            <Text style={styles.hintText}>
              {page === 0
                ? (page === reactIndex ? (T ? 'Kaydır: bir soru daha ›' : 'Swipe: one more question ›') : T ? 'Kaydır: tepki bırak ›' : 'Swipe: leave a reaction ›')
                : T
                  ? '‹ Geri'
                  : '‹ Back'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingHorizontal: 4 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D3D6E2' },
  dotOn: { width: 16, backgroundColor: BRAND },
  hintText: { fontFamily: F.bold, fontSize: 12.5, color: BRAND },
});

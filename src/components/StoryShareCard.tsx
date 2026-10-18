// Günün Sorusu — Instagram story kartı (360×640, 1080×1920 olarak kaydedilir).
// Tek şablon: çizim + tema rengi Supabase'ten, kulüp adı / yüzde / tarih o anki sonuçtan gelir.
// Ekranda görünmez; DailyResultReveal içinde ekran dışına çizilir ve fotoğrafı alınır.
import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { Lang } from '@/lib/i18n';
import { DQTheme, THEMES } from '@/lib/dailyQuestion';

export const STORY_W = 360;
export const STORY_H = 640;

type Props = {
  theme: DQTheme;
  artSvg: string | null;
  question: string;
  dateLabel: string; // '4 Kasım'
  club: string | null; // 'Kafein Kulübü' (yoksa seçenek adı büyük yazılır)
  option: string; // 'İkisi de'
  pct: number; // 0-100
  lang: Lang;
};

const F = { medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' };

const TEXT = {
  tr: {
    label: 'Günün Sorusu',
    with: 'benimle',
    officially: 'Resmen',
    member: (o: string) => `üyesiyim · ${o}`,
    picked: 'Benim cevabım',
    ask: 'Sen hangi kulüptesin?',
    askPlain: 'Sen ne cevap verirdin?',
  },
  en: {
    label: 'Question of the Day',
    with: 'with me',
    officially: 'Officially in the',
    member: (o: string) => `· ${o}`,
    picked: 'My answer',
    ask: 'Which club are you in?',
    askPlain: 'What would you answer?',
  },
};

export const StoryShareCard = forwardRef<View, Props>(function StoryShareCard(
  { theme, artSvg, question, dateLabel, club, option, pct, lang },
  ref
) {
  const t = THEMES[theme];
  const tx = (lang as string) === 'tr' ? TEXT.tr : TEXT.en;
  // Rozet: lacivert ve krem kartta sarı, sarı kartta lacivert
  const stickerBg = theme === 'amber' ? '#0F2A52' : '#FBBF24';
  const stickerFg = theme === 'amber' ? '#FBBF24' : '#0F2A52';
  const stickerSub = theme === 'amber' ? '#FFFFFF' : '#0F2A52';
  const big = club ?? option;
  const bigSize = big.length > 18 ? 36 : big.length > 13 ? 42 : 46;

  return (
    <View ref={ref} collapsable={false} style={[styles.card, { backgroundColor: t.bg }]}>
      <View style={styles.top}>
        <Text style={[styles.brand, { color: t.fg }]}>ŞU AN</Text>
        <View style={[styles.datePill, { backgroundColor: t.chip }]}>
          <Text style={[styles.dateText, { color: t.fg }]}>
            {tx.label} · {dateLabel}
          </Text>
        </View>
      </View>

      <Text style={[styles.question, { color: t.fg }]} numberOfLines={3}>
        {question}
      </Text>

      <View style={styles.artBox}>
        {artSvg ? <SvgXml xml={artSvg} width={312} height={250} /> : null}
        <View style={[styles.sticker, { backgroundColor: stickerBg }]}>
          <Text style={[styles.stickerPct, { color: stickerFg }]}>%{Math.round(pct)}</Text>
          <Text style={[styles.stickerSub, { color: stickerSub }]}>{tx.with}</Text>
        </View>
      </View>

      <View style={styles.clubBlock}>
        <Text style={[styles.pre, { color: theme === 'navy' ? '#FBBF24' : t.accent }]}>
          {club ? tx.officially : tx.picked}
        </Text>
        <Text style={[styles.club, { color: t.fg, fontSize: bigSize, lineHeight: bigSize * 1.04 }]} numberOfLines={2}>
          {big}
        </Text>
        {club ? (
          <Text style={[styles.member, { color: t.soft }]} numberOfLines={1}>
            {tx.member(option)}
          </Text>
        ) : null}
      </View>

      <View style={{ flex: 1 }} />

      <View style={[styles.bottom, { borderTopColor: t.line }]}>
        <Text style={[styles.ask, { color: t.fg }]}>{club ? tx.ask : tx.askPlain}</Text>
        <Text style={[styles.handle, { color: t.soft }]}>@suan.app</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: STORY_W,
    height: STORY_H,
    paddingTop: 38,
    paddingHorizontal: 24,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    fontFamily: F.bold,
    fontSize: 13,
    letterSpacing: 2,
  },
  datePill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dateText: {
    fontFamily: F.bold,
    fontSize: 12,
  },
  question: {
    marginTop: 20,
    fontFamily: F.bold,
    fontSize: 21,
    lineHeight: 27,
  },
  artBox: {
    height: 250,
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sticker: {
    position: 'absolute',
    right: 0,
    top: 2,
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '10deg' }],
  },
  stickerPct: {
    fontFamily: F.bold,
    fontSize: 26,
    lineHeight: 28,
  },
  stickerSub: {
    fontFamily: F.bold,
    fontSize: 11,
  },
  clubBlock: {
    marginTop: 8,
  },
  pre: {
    fontFamily: F.bold,
    fontSize: 15,
  },
  club: {
    fontFamily: F.bold,
    letterSpacing: -1,
  },
  member: {
    marginTop: 2,
    fontFamily: F.bold,
    fontSize: 15,
  },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
  },
  ask: {
    fontFamily: F.bold,
    fontSize: 15,
  },
  handle: {
    fontFamily: F.bold,
    fontSize: 13,
  },
});

// İnce alt menü: Şu An · Arkadaşlar · Anketler · Ben
// Ekrandan ayrışsın diye: üstte gölge ve çizgi, seçili sekmede simgenin arkasında renkli bir kapsül.
import { useEffect, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Lang } from '@/lib/i18n';
import { onPollsChanged, pollsBadge } from '@/lib/dailyQuestion';

export type TabId = 'now' | 'friends' | 'polls' | 'me';

export const TAB_BAR_HEIGHT = 64;

const ACTIVE = '#3F3BC9';
const ACTIVE_BG = '#E6ECFF';
const IDLE = '#6B6F7B';

const LABELS: Record<TabId, { tr: string; en: string }> = {
  now: { tr: 'Şu An', en: 'Now' },
  friends: { tr: 'Arkadaşlar', en: 'Friends' },
  polls: { tr: 'Anketler', en: 'Polls' },
  me: { tr: 'Ben', en: 'Me' },
};

const ICONS: Record<TabId, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  now: { on: 'home', off: 'home-outline' },
  friends: { on: 'people', off: 'people-outline' },
  polls: { on: 'chatbubbles', off: 'chatbubbles-outline' },
  me: { on: 'person', off: 'person-outline' },
};

export function TabBar({
  active,
  onChange,
  lang,
  showFriends,
  showPolls = false,
  bottomInset,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
  lang: Lang;
  showFriends: boolean;
  showPolls?: boolean; // Anketler sekmesi (seri başlayınca ve çevirisi olan dillerde)
  bottomInset: number;
}) {
  const tabs: TabId[] = ['now'];
  if (showFriends) tabs.push('friends');
  if (showPolls) tabs.push('polls');
  tabs.push('me');

  // Anketler sekmesinde sarı nokta: bugünün sorusu bekliyor ya da sonuç açıklandı
  const [pollsDot, setPollsDot] = useState(false);
  useEffect(() => {
    if (!showPolls) {
      setPollsDot(false);
      return;
    }
    let alive = true;
    const refresh = () => {
      pollsBadge(lang)
        .then((v) => alive && setPollsDot(v))
        .catch(() => {});
    };
    refresh();
    const offChange = onPollsChanged(refresh);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    const timer = setInterval(refresh, 5 * 60 * 1000); // 21:00 geçişini yakalamak için
    return () => {
      alive = false;
      offChange();
      sub.remove();
      clearInterval(timer);
    };
  }, [showPolls, lang, active]);

  return (
    <View
      style={[styles.bar, { height: TAB_BAR_HEIGHT + bottomInset, paddingBottom: bottomInset }]}
      accessibilityRole="tablist"
    >
      {tabs.map((t) => {
        const on = t === active;
        const color = on ? ACTIVE : IDLE;
        return (
          <Pressable
            key={t}
            style={styles.item}
            onPress={() => onChange(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={LABELS[t][lang]}
            hitSlop={6}
          >
            <View style={[styles.pill, on && styles.pillOn]}>
              <Ionicons name={on ? ICONS[t].on : ICONS[t].off} size={22} color={color} />
              {t === 'polls' && pollsDot && !on ? <View style={styles.dot} /> : null}
            </View>
            <Text style={[styles.label, { color }, on && styles.labelOn]}>{LABELS[t][lang]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E3E5EB',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 7,
    ...Platform.select({
      ios: { shadowColor: '#0F1A33', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 16 },
      default: {},
    }),
  },
  item: { flex: 1, maxWidth: 96, alignItems: 'center', gap: 3 },
  pill: { width: 58, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: ACTIVE_BG },
  dot: {
    position: 'absolute',
    top: 2,
    right: 14,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FBBF24',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  label: { fontFamily: 'DMSans_500Medium', fontSize: 11 },
  labelOn: { fontFamily: 'DMSans_700Bold' },
});

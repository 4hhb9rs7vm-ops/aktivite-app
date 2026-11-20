// İnce alt menü: Şu An · Anketler · Mesajlar · Arkadaşlar · Ben (1.6.0: Rozetler, Mesaj kutusunun içinde)
// Her sekmenin kendi rengi var (uygulamanın paletinden): boşta renkli çizgi simge,
// seçilince dolu simge + aynı rengin açık tonunda kapsül. Dokununca simge hafifçe zıplar.
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Lang } from '@/lib/i18n';
import { onPollsChanged, pollsBadge } from '@/lib/dailyQuestion';
import { inboxUnread, onInboxChanged } from '@/lib/inbox';

export type TabId = 'now' | 'friends' | 'polls' | 'badges' | 'inbox' | 'me';

export const TAB_BAR_HEIGHT = 64;

const IDLE_LABEL = '#6B6F7B';

const LABELS: Record<TabId, { tr: string; en: string }> = {
  now: { tr: 'Şu An', en: 'Now' },
  polls: { tr: 'Anketler', en: 'Polls' },
  badges: { tr: 'Rozetler', en: 'Badges' },
  inbox: { tr: 'Mesajlar', en: 'Inbox' },
  friends: { tr: 'Arkadaşlar', en: 'Friends' },
  me: { tr: 'Ben', en: 'Me' },
};

// color: simge ve yazı rengi, bg: seçiliyken kapsül rengi
const STYLE: Record<
  TabId,
  { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  now: { on: 'flash', off: 'flash-outline', color: '#4F46E5', bg: '#E6E9FF' }, // marka moru
  polls: { on: 'chatbubbles', off: 'chatbubbles-outline', color: '#D97706', bg: '#FFF1D6' }, // anket sarısı
  badges: { on: 'ribbon', off: 'ribbon-outline', color: '#DB2777', bg: '#FCE7F3' }, // rozet pembesi
  inbox: { on: 'mail', off: 'mail-outline', color: '#DB2777', bg: '#FCE7F3' }, // pembe (eski Rozetler rengi)
  friends: { on: 'people', off: 'people-outline', color: '#0E9F6E', bg: '#DDF5EA' }, // yeşil
  me: { on: 'person-circle', off: 'person-circle-outline', color: '#0F2A52', bg: '#E4EAF3' }, // lacivert
};

function TabItem({
  id,
  on,
  label,
  dot,
  onPress,
}: {
  id: TabId;
  on: boolean;
  label: string;
  dot: boolean;
  onPress: () => void;
}) {
  const s = STYLE[id];
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!on) return;
    scale.setValue(0.85);
    Animated.spring(scale, { toValue: 1, speed: 18, bounciness: 12, useNativeDriver: true }).start();
  }, [on]);

  return (
    <Pressable
      style={styles.item}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      hitSlop={6}
    >
      <Animated.View style={[styles.pill, on && { backgroundColor: s.bg }, { transform: [{ scale }] }]}>
        <Ionicons name={on ? s.on : s.off} size={23} color={s.color} />
        {dot ? <View style={styles.dot} /> : null}
      </Animated.View>
      <Text style={[styles.label, { color: on ? s.color : IDLE_LABEL }, on && styles.labelOn]}>{label}</Text>
    </Pressable>
  );
}

export function TabBar({
  active,
  onChange,
  lang,
  showFriends,
  showPolls = false,
  showBadges = false,
  bottomInset,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
  lang: Lang;
  showFriends: boolean;
  showPolls?: boolean; // Anketler sekmesi (seri başlayınca ve çevirisi olan dillerde)
  showBadges?: boolean; // 1.6.0'dan beri kullanılmıyor: Rozetler, Mesaj kutusunun içinde
  bottomInset: number;
}) {
  // Sıra: Şu An · Anketler · Mesajlar · Arkadaşlar · Ben (Arkadaşlar ve Ben yan yana)
  const tabs: TabId[] = ['now'];
  if (showPolls) tabs.push('polls');
  tabs.push('inbox');
  if (showFriends) tabs.push('friends');
  tabs.push('me');
  void showBadges;

  // 1.6.0: Mesajlar sekmesinde nokta: son açılıştan beri yeni tepki ya da sorularına cevap geldi
  const [inboxDot, setInboxDot] = useState(false);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      inboxUnread()
        .then((v) => alive && setInboxDot(v))
        .catch(() => {});
    };
    refresh();
    const off = onInboxChanged(refresh);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    const timer = setInterval(refresh, 3 * 60 * 1000);
    return () => {
      alive = false;
      off();
      sub.remove();
      clearInterval(timer);
    };
  }, [active]);

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
      {tabs.map((t) => (
        <TabItem
          key={t}
          id={t}
          on={t === active}
          label={LABELS[t][lang]}
          dot={t !== active && ((t === 'polls' && pollsDot) || (t === 'inbox' && inboxDot))}
          onPress={() => onChange(t)}
        />
      ))}
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
  pill: { width: 54, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute',
    top: 1,
    right: 12,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#F4B88A',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  label: { fontFamily: 'DMSans_500Medium', fontSize: 10.5 },
  labelOn: { fontFamily: 'DMSans_700Bold' },
});

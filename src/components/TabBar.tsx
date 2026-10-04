// İnce alt menü: Şu An · Arkadaşlar · Ben
// Ekrandan ayrışsın diye: üstte gölge ve çizgi, seçili sekmede simgenin arkasında renkli bir kapsül.
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Lang } from '@/lib/i18n';

export type TabId = 'now' | 'friends' | 'me';

export const TAB_BAR_HEIGHT = 64;

const ACTIVE = '#3F3BC9';
const ACTIVE_BG = '#E6ECFF';
const IDLE = '#6B6F7B';

const LABELS: Record<TabId, { tr: string; en: string }> = {
  now: { tr: 'Şu An', en: 'Now' },
  friends: { tr: 'Arkadaşlar', en: 'Friends' },
  me: { tr: 'Ben', en: 'Me' },
};

const ICONS: Record<TabId, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  now: { on: 'home', off: 'home-outline' },
  friends: { on: 'people', off: 'people-outline' },
  me: { on: 'person', off: 'person-outline' },
};

export function TabBar({
  active,
  onChange,
  lang,
  showFriends,
  bottomInset,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
  lang: Lang;
  showFriends: boolean;
  bottomInset: number;
}) {
  const tabs: TabId[] = showFriends ? ['now', 'friends', 'me'] : ['now', 'me'];
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
  item: { width: 96, alignItems: 'center', gap: 3 },
  pill: { width: 58, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: ACTIVE_BG },
  label: { fontFamily: 'DMSans_500Medium', fontSize: 11 },
  labelOn: { fontFamily: 'DMSans_700Bold' },
});

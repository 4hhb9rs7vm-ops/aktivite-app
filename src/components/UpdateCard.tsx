// 1.6.0: "Yeni sürüm var" kartı. Mağazadaki son sürüm sunucudan gelir (cat_settings.latest_version).
// Altındaki sürümlerde ana ekranın üstünde görünür; kapatılınca o sürüm için bir daha çıkmaz.
// min_version'ın altındaysa kapatılamaz (zorunlu güncelleme gerektiğinde).
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import type { Lang } from '@/lib/i18n';
import { getCatalog, versionCode } from '@/lib/catalog';

const KEY = 'update_dismissed_v1'; // kapatılan sürüm kodu
const IOS_URL = 'https://apps.apple.com/app/id6817275887';
const ANDROID_MARKET = 'market://details?id=com.tvfk.aktiviteapp';
const ANDROID_WEB = 'https://play.google.com/store/apps/details?id=com.tvfk.aktiviteapp';

export function UpdateCard({ lang, catalogVer, style }: { lang: Lang; catalogVer: number; style?: StyleProp<ViewStyle> }) {
  const T = (lang as string) === 'tr';
  const [state, setState] = useState<'hidden' | 'soft' | 'hard'>('hidden');
  const [latest, setLatest] = useState(0);

  useEffect(() => {
    const s = getCatalog()?.settings;
    const mine = versionCode(Constants.expoConfig?.version);
    if (!s || !mine || !s.latestVersion || mine >= s.latestVersion) {
      setState('hidden');
      return;
    }
    setLatest(s.latestVersion);
    if (s.minVersion && mine < s.minVersion) {
      setState('hard');
      return;
    }
    AsyncStorage.getItem(KEY)
      .then((v) => setState(Number(v) >= s.latestVersion ? 'hidden' : 'soft'))
      .catch(() => setState('soft'));
  }, [catalogVer]);

  if (state === 'hidden') return null;

  function open() {
    if (Platform.OS === 'ios') Linking.openURL(IOS_URL).catch(() => {});
    else Linking.openURL(ANDROID_MARKET).catch(() => Linking.openURL(ANDROID_WEB).catch(() => {}));
  }

  return (
    <View style={[styles.card, style]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{T ? 'Yeni sürüm var ✨' : 'A new version is out ✨'}</Text>
        <Text style={styles.sub}>
          {state === 'hard'
            ? T
              ? 'Bu sürüm artık desteklenmiyor. Devam etmek için güncelle.'
              : 'This version is no longer supported. Update to continue.'
            : T
              ? 'Yeni özellikleri görmek için güncelle.'
              : 'Update to get the latest features.'}
        </Text>
      </View>
      <Pressable onPress={open} style={styles.btn} accessibilityRole="button">
        <Text style={styles.btnText}>{T ? 'Güncelle' : 'Update'}</Text>
      </Pressable>
      {state === 'soft' ? (
        <Pressable
          onPress={() => {
            setState('hidden');
            AsyncStorage.setItem(KEY, String(latest)).catch(() => {});
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={T ? 'Kapat' : 'Close'}
        >
          <Text style={styles.close}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: '#F4B88A',
  },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 14.5, color: '#0F2A52' },
  sub: { fontFamily: 'DMSans_500Medium', fontSize: 12.5, color: '#6B7080', marginTop: 2 },
  btn: { backgroundColor: '#0F2A52', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 14 },
  btnText: { fontFamily: 'DMSans_700Bold', fontSize: 13.5, color: '#ffffff' },
  close: { fontFamily: 'DMSans_700Bold', fontSize: 15, color: '#9AA0B4', paddingLeft: 2 },
});

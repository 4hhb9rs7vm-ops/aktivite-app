// 1.6.0: Mağaza sayfasını aç (güncelleme kartı ve "update" türündeki bildirimler).
import { Linking, Platform } from 'react-native';

const IOS_URL = 'https://apps.apple.com/app/id6817275887';
const ANDROID_MARKET = 'market://details?id=com.tvfk.aktiviteapp';
const ANDROID_WEB = 'https://play.google.com/store/apps/details?id=com.tvfk.aktiviteapp';

export function openStore(): void {
  if (Platform.OS === 'ios') Linking.openURL(IOS_URL).catch(() => {});
  else Linking.openURL(ANDROID_MARKET).catch(() => Linking.openURL(ANDROID_WEB).catch(() => {}));
}

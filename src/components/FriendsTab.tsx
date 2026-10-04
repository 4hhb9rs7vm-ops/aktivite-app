// Arkadaşlar sekmesi: 1.2'de boş durum. QR ile eşleşme 1.3'te gelecek.
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Lang } from '@/lib/i18n';

const T = {
  tr: {
    title: 'Arkadaşlar',
    lead: 'Arkadaşlarının şu anki anları. Sadece yan yana eşleştiğin kişiler burada.',
    emptyTitle: 'Arkadaşların burada görünecek',
    emptyText:
      'Yan yana gelip QR okuttuğun kişilerin şu an ne yaptığını burada göreceksin. Sohbet yok, takip yok, geçmiş yok; sadece şu an.',
    qr: 'QR ile ekle',
    soon: 'Yakında',
  },
  en: {
    title: 'Friends',
    lead: "Your friends' current moments. Only people you've paired with side by side appear here.",
    emptyTitle: 'Your friends will show up here',
    emptyText:
      "You'll see what the people you scanned QR codes with are doing right now. No chat, no following, no history; just right now.",
    qr: 'Add with QR',
    soon: 'Soon',
  },
};

export function FriendsTab({ lang, topInset, bottomSpace }: { lang: Lang; topInset: number; bottomSpace: number }) {
  const t = T[lang];
  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topInset + 16, paddingBottom: bottomSpace }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headRow}>
          <Text style={styles.title}>{t.title}</Text>
          <View style={styles.qrBtn} accessibilityState={{ disabled: true }}>
            <Ionicons name="qr-code-outline" size={17} color="#FFFFFF" />
            <Text style={styles.qrText}>{t.qr}</Text>
          </View>
        </View>
        <Text style={styles.lead}>{t.lead}</Text>

        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="people-outline" size={30} color="#3F3BC9" />
          </View>
          <Text style={styles.emptyTitle}>{t.emptyTitle}</Text>
          <Text style={styles.emptyText}>{t.emptyText}</Text>
          <View style={styles.soonPill}>
            <Text style={styles.soonText}>{t.soon}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Kaydırınca içerik saatin ve pilin altına girmesin */}
      <View style={[styles.statusShade, { height: topInset }]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F5F7' },
  statusShade: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#F4F5F7' },
  content: { paddingHorizontal: 20, gap: 14 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 28, color: '#16161A', letterSpacing: -0.3 },
  qrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#3F3BC9',
    opacity: 0.35,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 999,
  },
  qrText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#FFFFFF' },
  lead: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 18, color: '#4A4E5A' },
  empty: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E6ECFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontFamily: 'DMSans_700Bold', fontSize: 17, color: '#16161A', textAlign: 'center' },
  emptyText: { fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20, color: '#4A4E5A', textAlign: 'center' },
  soonPill: { backgroundColor: '#F0F1F4', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, marginTop: 4 },
  soonText: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: '#6B6F7B' },
});

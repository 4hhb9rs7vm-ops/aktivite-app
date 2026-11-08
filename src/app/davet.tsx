// Davet linki: aktiviteapp://davet?c=K472&n=Kaan
// Web'deki davet sayfasındaki "Uygulamada aç" butonu buraya gelir.
// Daveti bu ekranda gösterir: "Kaan seni arkadaş olarak eklemek istiyor" → Kabul et / Reddet.
// (Eskiden Arkadaşlar sekmesine geçip orada panel açıyorduk; iPhone ekran geçişi sırasında açılan paneli göstermiyordu.)
// Kabul edince ikisi hemen arkadaş olur, davet edene "arkadaşın oldu" bildirimi gider.
// Görünen ad henüz seçilmediyse Arkadaşlar sekmesine geçer, ad seçilince kod paneli orada açılır.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';

import {
  cleanCode,
  enableInviteNotifications,
  isValidCode,
  notifyInvitesChanged,
  requestInvite,
  setPendingInviteCode,
} from '@/lib/invite';
import { openTabFromNotification } from '@/lib/ask';
import { loadLang } from '@/lib/i18n';
import { track } from '@/lib/analytics';
import { Avatar } from '@/components/QrSheet';

const BG = '#F4F5F7';
const INK = '#16161A';
const SOFT = '#4A4E5A';
const MUTED = '#6B6F7B';
const ACCENT = '#3F3BC9';
const DANGER = '#B3261E';
const F = { regular: 'DMSans_400Regular', medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' };

const T = {
  tr: {
    title: (n: string) => (n ? `${n} seni arkadaş olarak eklemek istiyor 👋` : 'Arkadaşın seni Şu An’a davet ediyor 👋'),
    code: 'Davet kodu',
    text: (n: string) =>
      `Kabul edersen ${n ? n + ' ile' : 'arkadaşınla'} arkadaş olursunuz. Birbirinizin şu anki anını görür, birbirinize “Şu an ne yapıyorsun?” diye sorabilirsiniz.`,
    send: 'Kabul et',
    cancel: 'Reddet',
    sentTitle: 'Artık arkadaşsınız 🎉',
    sentText: (n: string) =>
      `${n || 'Arkadaşın'} arkadaş listene eklendi, ona da haber verdik. Şu anki anını görebilir, ona sorabilirsin 👀`,
    toFriends: 'Arkadaşlarıma git',
    err: {
      too_many: 'Çok fazla deneme yaptın. 1 saat sonra tekrar dene.',
      not_found: 'Bu davetin süresi dolmuş ya da iptal edilmiş. Arkadaşından yeni bir link iste.',
      full: 'Bu davet doldu. Arkadaşından yeni bir link iste.',
      self: 'Bu senin kendi davetin 🙂 Linki arkadaşına gönder; o açınca sana istek gelir, sen onaylarsın.',
      already: 'Zaten arkadaşsınız 🎉',
      pending: 'İsteğin zaten gönderildi, onay bekleniyor.',
      limit_me: 'Arkadaş sınırına ulaştın (50).',
      limit_them: 'Arkadaşının listesi dolu (50).',
      network: 'Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.',
    } as Record<string, string>,
  },
  en: {
    title: (n: string) => (n ? `${n} wants to add you as a friend 👋` : 'A friend invited you to Şu An 👋'),
    code: 'Invite code',
    text: (n: string) =>
      `Accept and you'll be friends with ${n || 'your friend'}. You'll see each other's current moment and can ask “What are you doing right now?”`,
    send: 'Accept',
    cancel: 'Decline',
    sentTitle: "You're friends now 🎉",
    sentText: (n: string) =>
      `${n || 'Your friend'} was added to your list and we let them know. See their current moment and ask them 👀`,
    toFriends: 'Go to my friends',
    err: {
      too_many: 'Too many attempts. Try again in an hour.',
      not_found: 'This invite has expired or was cancelled. Ask your friend for a new link.',
      full: 'This invite is full. Ask your friend for a new link.',
      self: "This is your own invite 🙂 Send the link to a friend; when they open it, you'll get a request to approve.",
      already: "You're already friends 🎉",
      pending: 'Your request was already sent and is waiting for approval.',
      limit_me: 'You reached the friend limit (50).',
      limit_them: "Your friend's list is full (50).",
      network: "Couldn't connect. Check your internet and try again.",
    } as Record<string, string>,
  },
};

type Phase = 'ask' | 'busy' | 'sent' | 'done';

export default function DavetLink() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const code = cleanCode(typeof params?.c === 'string' ? params.c : '');
  const fromName = (typeof params?.n === 'string' ? params.n : '').replace(/[<>]/g, '').trim().slice(0, 24);
  const valid = isValidCode(code);

  const [lang, setLang] = useState<'tr' | 'en'>('tr');
  const [phase, setPhase] = useState<Phase>('ask');
  const [err, setErr] = useState('');
  const [errKind, setErrKind] = useState('');
  const [name, setName] = useState(fromName);
  const t = T[lang];

  useEffect(() => {
    loadLang()
      .then((l) => setLang(l === 'en' ? 'en' : 'tr'))
      .catch(() => {});
  }, []);

  function leave() {
    openTabFromNotification('friends');
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  // Kod yoksa ya da bozuksa eskisi gibi doğrudan Arkadaşlar sekmesine geç
  useEffect(() => {
    if (valid) {
      track('invite_link_open', {});
      return;
    }
    const id = setTimeout(leave, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid]);

  async function send() {
    if (phase === 'busy') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setErr('');
    setErrKind('');
    setPhase('busy');
    // Arkadaşın sana sorunca bildirim gelsin
    await enableInviteNotifications();
    const r = await requestInvite(code);
    if ('error' in r) {
      if (r.error === 'no_profile') {
        // Henüz görünen ad yok: Arkadaşlar sekmesinde adını seçsin, ardından kod paneli orada açılır
        setPendingInviteCode(code);
        leave();
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setErr(t.err[r.error] ?? t.err.network);
      setErrKind(r.error);
      setPhase(r.error === 'already' || r.error === 'pending' || r.error === 'self' ? 'done' : 'ask');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const joined = (r as { ok: true; name: string }).name;
    if (joined) setName(joined);
    notifyInvitesChanged();
    setPhase('sent');
  }

  if (!valid) return <View style={{ flex: 1, backgroundColor: BG }} />;

  const showName = name || fromName;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <Pressable onPress={leave} hitSlop={12} accessibilityRole="button" accessibilityLabel={t.cancel}>
          <Ionicons name="close" size={26} color={SOFT} />
        </Pressable>
      </View>

      <View style={styles.body}>
        {phase === 'sent' ? (
          <>
            <View style={styles.okIcon}>
              <Ionicons name="checkmark" size={40} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>{t.sentTitle}</Text>
            <Text style={styles.text}>{t.sentText(showName)}</Text>
          </>
        ) : (
          <>
            <View style={styles.avatarWrap}>
              <Avatar name={showName || '?'} />
            </View>
            <Text style={styles.title}>{t.title(showName)}</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>{t.code}</Text>
              <Text style={styles.codeText}>{code.split('').join(' ')}</Text>
            </View>
            {phase !== 'done' ? <Text style={styles.text}>{t.text(showName)}</Text> : null}
            {err ? (
              <Text style={[styles.err, errKind === 'already' || errKind === 'pending' || errKind === 'self' ? { color: SOFT } : null]}>
                {err}
              </Text>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.actions}>
        {phase === 'sent' || phase === 'done' ? (
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
            onPress={leave}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{t.toFriends}</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
              onPress={send}
              disabled={phase === 'busy'}
              accessibilityRole="button"
            >
              {phase === 'busy' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryText}>{t.send}</Text>
              )}
            </Pressable>
            <Pressable style={styles.ghostBtn} onPress={leave} accessibilityRole="button">
              <Text style={styles.ghostText}>{t.cancel}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, paddingHorizontal: 24 },
  topBar: { height: 44, justifyContent: 'center' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  avatarWrap: { transform: [{ scale: 1.6 }], marginBottom: 14 },
  okIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#1F9D55',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 25, lineHeight: 32, fontFamily: F.bold, color: INK, textAlign: 'center' },
  codeBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 26,
    alignItems: 'center',
    gap: 4,
  },
  codeLabel: { fontSize: 12, fontFamily: F.bold, letterSpacing: 1.2, color: MUTED, textTransform: 'uppercase' },
  codeText: { fontSize: 30, fontFamily: F.bold, color: ACCENT, letterSpacing: 2 },
  text: { fontFamily: F.regular, fontSize: 15.5, lineHeight: 22, color: SOFT, textAlign: 'center', paddingHorizontal: 6 },
  err: { fontSize: 15, lineHeight: 21, color: DANGER, textAlign: 'center', fontFamily: F.medium, paddingHorizontal: 6 },
  actions: { gap: 10 },
  primaryBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontFamily: F.bold },
  ghostBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#E9EAEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { color: INK, fontSize: 16, fontFamily: F.bold },
});

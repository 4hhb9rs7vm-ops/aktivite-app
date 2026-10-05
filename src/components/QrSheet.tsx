// QR ile arkadaş ekleme: "Kodum" (kodu göster) ve "Kod okut" (kamera + onay).
// Kodu gösteren kişi eşleşmeye razıdır; okutan kişi onaylayınca ikisi aynı anda eklenir.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';

import { Lang } from '@/lib/i18n';
import {
  avatarColors,
  createPairCode,
  FRIEND_LIMIT,
  PAIR_CODE_SECONDS,
  pairCodeStatus,
  PairError,
  parseQr,
  peekPairCode,
  qrValue,
  redeemPairCode,
} from '@/lib/friends';
import { nameInitial } from '@/lib/me';

const INK = '#16161A';
const SOFT = '#4A4E5A';
const MUTED = '#6B6F7B';
const ACCENT = '#3F3BC9';
const NAVY = '#17284D';
const F = { regular: 'DMSans_400Regular', medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' };

const T = {
  tr: {
    title: 'Arkadaş ekle',
    mine: 'Kodum',
    scan: 'Kod okut',
    refreshIn: (s: string) => `${s} sonra yenilenir`,
    mineHint: "Arkadaşın yanındayken Şu An'da Kod okut ile tarasın. Kod tek kullanımlık, ekran görüntüsüyle çalışmaz.",
    count: (n: number) => `${n} / ${FRIEND_LIMIT} arkadaş`,
    added: (name: string) => `${name} ile artık arkadaşsınız`,
    addedSub: 'İkiniz de birbirinin şu anki anını görebilir',
    frameHint: 'Arkadaşının kodunu çerçeveye getir',
    confirmTitle: (name: string) => `${name} ile arkadaş ol?`,
    confirmText:
      'Onaylarsan ikiniz aynı anda birbirinizin listesine eklenirsiniz. Sadece şu anki anınız görünür; geçmiş, meslek, üniversite ve yaş görünmez.',
    befriend: 'Arkadaş ol',
    cancel: 'Vazgeç',
    retry: 'Tekrar dene',
    scanAgain: 'Tekrar okut',
    camTitle: 'Kamera izni gerekiyor',
    camText: 'Arkadaşının kodunu okutmak için kameraya erişmemiz gerekiyor. Kamera sadece kod okurken açılır.',
    camAllow: 'İzin ver',
    camSettings: 'Ayarları aç',
    notOurs: 'Bu bir Şu An kodu değil.',
    errors: {
      expired: 'Kodun süresi dolmuş. Arkadaşından kodu yenilemesini iste.',
      self: 'Bu senin kendi kodun.',
      already: 'Zaten arkadaşsınız.',
      limit_me: `Arkadaş sınırına ulaştın (${FRIEND_LIMIT}). Yeni biri için önce birini çıkarmalısın.`,
      limit_them: `Arkadaşının listesi dolu (${FRIEND_LIMIT}).`,
      no_profile: 'Önce görünen adını seçmelisin.',
      invalid: 'Bu bir Şu An kodu değil.',
      network: 'Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.',
    } as Record<PairError, string>,
  },
  en: {
    title: 'Add a friend',
    mine: 'My code',
    scan: 'Scan code',
    refreshIn: (s: string) => `Refreshes in ${s}`,
    mineHint: "When you're together, your friend scans it with Scan code in Şu An. Single use; screenshots won't work.",
    count: (n: number) => `${n} / ${FRIEND_LIMIT} friends`,
    added: (name: string) => `You and ${name} are now friends`,
    addedSub: "You can both see each other's current moment",
    frameHint: "Fit your friend's code in the frame",
    confirmTitle: (name: string) => `Be friends with ${name}?`,
    confirmText:
      "If you confirm, you'll be added to each other's lists at the same time. Only your current moment is visible; no history, occupation, university or age.",
    befriend: 'Be friends',
    cancel: 'Cancel',
    retry: 'Try again',
    scanAgain: 'Scan again',
    camTitle: 'Camera access needed',
    camText: "To scan your friend's code we need the camera. It's only on while scanning.",
    camAllow: 'Allow',
    camSettings: 'Open settings',
    notOurs: "This isn't a Şu An code.",
    errors: {
      expired: 'This code has expired. Ask your friend to refresh it.',
      self: 'This is your own code.',
      already: "You're already friends.",
      limit_me: `You've reached the friend limit (${FRIEND_LIMIT}). Remove someone first.`,
      limit_them: `Your friend's list is full (${FRIEND_LIMIT}).`,
      no_profile: 'Choose your display name first.',
      invalid: "This isn't a Şu An code.",
      network: "Couldn't connect. Check your internet and try again.",
    } as Record<PairError, string>,
  },
};

function fmt(sec: number) {
  const s = Math.max(0, sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function QrSheet({
  visible,
  lang,
  friendCount,
  bottomInset,
  onClose,
  onAdded,
}: {
  visible: boolean;
  lang: Lang;
  friendCount: number;
  bottomInset: number;
  onClose: () => void;
  onAdded: (name: string) => void;
}) {
  const t = T[lang];
  const [tab, setTab] = useState<'mine' | 'scan'>('mine');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTab('mine');
      setToast(null);
    }
  }, [visible]);

  const showAdded = useCallback(
    (name: string) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setToast(name);
      onAdded(name);
      setTimeout(() => setToast(null), 3500);
    },
    [onAdded]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.wrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t.cancel} />

        {toast ? (
          <View style={styles.toast} accessibilityRole="alert">
            <Avatar name={toast} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.toastTitle}>{t.added(toast)}</Text>
              <Text style={styles.toastSub}>{t.addedSub}</Text>
            </View>
            <View style={styles.toastCheck}>
              <Ionicons name="checkmark" size={16} color="#146C43" />
            </View>
          </View>
        ) : null}

        <View style={[styles.sheet, { paddingBottom: 24 + bottomInset }]}>
          <View style={styles.grabber} />
          <View style={styles.head}>
            <Text style={styles.title}>{t.title}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={t.cancel}>
              <Ionicons name="close" size={20} color={INK} />
            </Pressable>
          </View>

          <View style={styles.tabs} accessibilityRole="tablist">
            {(['mine', 'scan'] as const).map((k) => {
              const on = tab === k;
              return (
                <Pressable
                  key={k}
                  style={[styles.tab, on && styles.tabOn]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setTab(k);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                >
                  <Ionicons name={k === 'mine' ? 'qr-code-outline' : 'scan-outline'} size={16} color={on ? INK : SOFT} />
                  <Text style={[styles.tabText, on && styles.tabTextOn]}>{k === 'mine' ? t.mine : t.scan}</Text>
                </Pressable>
              );
            })}
          </View>

          {visible && tab === 'mine' ? (
            <MyCode lang={lang} friendCount={friendCount} onUsed={showAdded} />
          ) : null}
          {visible && tab === 'scan' ? (
            <ScanCode
              lang={lang}
              onDone={(name) => {
                showAdded(name);
                setTimeout(onClose, 1400);
              }}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

// ---- Kodum ----
function MyCode({ lang, friendCount, onUsed }: { lang: Lang; friendCount: number; onUsed: (name: string) => void }) {
  const t = T[lang];
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<PairError | null>(null);
  const [left, setLeft] = useState(PAIR_CODE_SECONDS);
  const expiresAt = useRef(0);
  const alive = useRef(true);

  const fresh = useCallback(async () => {
    setError(null);
    setCode(null);
    const r = await createPairCode();
    if (!alive.current) return;
    if ('code' in r) {
      setCode(r.code);
      expiresAt.current = Date.now() + PAIR_CODE_SECONDS * 1000;
      setLeft(PAIR_CODE_SECONDS);
    } else {
      setError(r.error);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    fresh();
    return () => {
      alive.current = false;
    };
  }, [fresh]);

  // Geri sayım; süre bitince yeni kod
  useEffect(() => {
    if (!code) return;
    const id = setInterval(() => {
      const s = Math.ceil((expiresAt.current - Date.now()) / 1000);
      setLeft(s);
      if (s <= 0) fresh();
    }, 1000);
    return () => clearInterval(id);
  }, [code, fresh]);

  // Kod okutuldu mu? İki saniyede bir sor
  useEffect(() => {
    if (!code) return;
    let stop = false;
    const id = setInterval(async () => {
      const s = await pairCodeStatus(code);
      if (stop || !alive.current) return;
      if (s.used) {
        clearInterval(id);
        onUsed(s.name ?? '');
        fresh();
      }
    }, 2000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [code, fresh, onUsed]);

  return (
    <View style={styles.body}>
      <View style={styles.qrCard}>
        {error ? (
          <View style={styles.qrPlaceholder}>
            <Ionicons name="alert-circle-outline" size={30} color={MUTED} />
            <Text style={styles.errText}>{t.errors[error]}</Text>
            {error === 'network' ? (
              <Pressable style={styles.smallBtn} onPress={fresh}>
                <Text style={styles.smallBtnText}>{t.retry}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : code ? (
          <QRCode value={qrValue(code)} size={210} color={NAVY} backgroundColor="#FFFFFF" />
        ) : (
          <View style={styles.qrPlaceholder}>
            <ActivityIndicator color={ACCENT} />
          </View>
        )}
        {code && !error ? (
          <View style={styles.refreshRow}>
            <Ionicons name="refresh" size={15} color={SOFT} />
            <Text style={styles.refreshText}>{t.refreshIn(fmt(left))}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.hint}>{t.mineHint}</Text>
      <Text style={styles.count}>{t.count(friendCount)}</Text>
    </View>
  );
}

// ---- Kod okut ----
function ScanCode({ lang, onDone }: { lang: Lang; onDone: (name: string) => void }) {
  const t = T[lang];
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<'scan' | 'checking' | 'confirm' | 'saving' | 'error' | 'done'>('scan');
  const [code, setCode] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<PairError | null>(null);
  const busy = useRef(false);

  async function onScanned(data: string) {
    if (busy.current) return;
    busy.current = true;
    Haptics.selectionAsync().catch(() => {});
    const c = parseQr(data);
    if (!c) {
      setError('invalid');
      setPhase('error');
      return;
    }
    setCode(c);
    setPhase('checking');
    const r = await peekPairCode(c);
    if ('name' in r) {
      setName(r.name);
      setPhase('confirm');
    } else {
      setError(r.error);
      setPhase('error');
    }
  }

  async function confirm() {
    if (!code) return;
    setPhase('saving');
    const r = await redeemPairCode(code);
    if ('name' in r) {
      setPhase('done');
      onDone(r.name);
    } else {
      setError(r.error);
      setPhase('error');
    }
  }

  function again() {
    setError(null);
    setCode(null);
    setName('');
    setPhase('scan');
    busy.current = false;
  }

  if (!permission) {
    return (
      <View style={[styles.body, { minHeight: 300, justifyContent: 'center' }]}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.body, { gap: 12 }]}>
        <View style={styles.camIcon}>
          <Ionicons name="camera-outline" size={28} color={ACCENT} />
        </View>
        <Text style={styles.centerTitle}>{t.camTitle}</Text>
        <Text style={styles.hint}>{t.camText}</Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
        >
          <Text style={styles.primaryText}>{permission.canAskAgain ? t.camAllow : t.camSettings}</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'confirm' || phase === 'saving' || phase === 'done') {
    return (
      <View style={[styles.body, { gap: 12 }]}>
        <Avatar name={name} size={64} />
        <Text style={styles.centerTitle}>{t.confirmTitle(name)}</Text>
        <Text style={styles.hint}>{t.confirmText}</Text>
        <Pressable style={styles.primaryBtn} onPress={confirm} disabled={phase !== 'confirm'}>
          {phase === 'confirm' ? (
            <Text style={styles.primaryText}>{t.befriend}</Text>
          ) : phase === 'saving' ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Ionicons name="checkmark" size={22} color="#FFFFFF" />
          )}
        </Pressable>
        {phase === 'confirm' ? (
          <Pressable style={styles.ghostBtn} onPress={again}>
            <Text style={styles.ghostText}>{t.cancel}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.body, { gap: 14 }]}>
      <Text style={styles.hint}>{t.frameHint}</Text>
      <View style={styles.camBox}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={phase === 'scan' ? ({ data }) => onScanned(data) : undefined}
        />
        <View style={styles.camFrame} pointerEvents="none" />
        {phase === 'checking' ? (
          <View style={styles.camOverlay}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : null}
      </View>
      {phase === 'error' && error ? (
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Text style={styles.errText}>{t.errors[error]}</Text>
          <Pressable style={styles.smallBtn} onPress={again}>
            <Text style={styles.smallBtnText}>{t.scanAgain}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const [bg, fg] = avatarColors(name || '?');
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: F.bold, fontSize: Math.round(size * 0.4), color: fg }}>{nameInitial(name) || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,14,28,0.45)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#D9DBE1', marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: F.bold, fontSize: 22, color: INK },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F0F1F4', alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: '#F0F1F4', borderRadius: 999, padding: 4, marginTop: 14 },
  tab: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 999 },
  tabOn: { backgroundColor: '#FFFFFF' },
  tabText: { fontFamily: F.medium, fontSize: 14, color: SOFT },
  tabTextOn: { fontFamily: F.bold, color: INK },
  body: { alignItems: 'center', paddingTop: 18, gap: 14 },
  qrCard: {
    borderWidth: 1,
    borderColor: '#E6E7EC',
    borderRadius: 24,
    padding: 18,
    alignItems: 'center',
    gap: 12,
  },
  qrPlaceholder: { width: 210, height: 210, alignItems: 'center', justifyContent: 'center', gap: 10 },
  refreshRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  refreshText: { fontFamily: F.medium, fontSize: 13, color: SOFT },
  hint: { fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: SOFT, textAlign: 'center' },
  count: { fontFamily: F.medium, fontSize: 12, color: MUTED },
  errText: { fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: '#B3261E', textAlign: 'center' },
  smallBtn: { backgroundColor: '#F0F1F4', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999 },
  smallBtnText: { fontFamily: F.bold, fontSize: 14, color: INK },
  centerTitle: { fontFamily: F.bold, fontSize: 21, color: INK, textAlign: 'center' },
  camIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E6ECFF', alignItems: 'center', justifyContent: 'center' },
  camBox: { width: 260, height: 260, borderRadius: 28, overflow: 'hidden', backgroundColor: '#0E1424' },
  camFrame: {
    position: 'absolute',
    top: 30,
    left: 30,
    right: 30,
    bottom: 30,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  camOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(14,20,36,0.55)', alignItems: 'center', justifyContent: 'center' },
  primaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: ACCENT,
    borderRadius: 16,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryText: { fontFamily: F.bold, fontSize: 16, color: '#FFFFFF' },
  ghostBtn: { alignSelf: 'stretch', backgroundColor: '#F0F1F4', borderRadius: 16, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: F.bold, fontSize: 16, color: INK },
  toast: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#0F1A33',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  toastTitle: { fontFamily: F.bold, fontSize: 15, color: INK },
  toastSub: { fontFamily: F.regular, fontSize: 12, color: SOFT, marginTop: 1 },
  toastCheck: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E3F5EC', alignItems: 'center', justifyContent: 'center' },
});

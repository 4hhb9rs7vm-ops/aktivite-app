// Arkadaşlar sekmesi: ilk açılış (görünen ad + tek kural), arkadaş listesi, QR ile ekleme,
// sessize alma, arkadaşlıktan çıkarma ve şikayet. Arkadaşlar sadece birbirinin ŞU ANKİ anını görür.
import { ComponentType, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';

import { Lang } from '@/lib/i18n';
import {
  Friend,
  FRIEND_LIMIT,
  getFriends,
  isFriendsSetup,
  loadMutes,
  removeFriend,
  reportFriend,
  ReportReason,
  saveMutes,
  setupFriends,
} from '@/lib/friends';
import { checkDisplayName, cleanDisplayName, Me, NAME_MAX, nameError, nameLength } from '@/lib/me';
import { Avatar, QrSheet } from '@/components/QrSheet';

const BG = '#F4F5F7';
const INK = '#16161A';
const SOFT = '#4A4E5A';
const MUTED = '#6B6F7B';
const ACCENT = '#3F3BC9';
const DANGER = '#B3261E';
const F = { regular: 'DMSans_400Regular', medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' };

export type ActivityInfo = {
  name: string;
  Icon: ComponentType<{ size?: number; color?: string; weight?: any }>;
  fg: string;
  bg: string;
};

const T = {
  tr: {
    title: 'Arkadaşlar',
    lead: 'Arkadaşlarının şu anki anları. Sadece yan yana eşleştiğin kişiler burada.',
    qr: 'QR ile ekle',
    setupTitle: 'Önce iki küçük adım',
    setupText: 'Arkadaşların sadece şu anki anını görür. Sohbet yok, geçmiş yok.',
    step1: '1. Görünen adını seç',
    step1Sub: 'Gerçek adın olması gerekmez. Sadece arkadaşların görür.',
    namePh: 'Örn. Ayşe ya da Kahve 🐱',
    step2: '2. Tek kuralımız',
    rule: 'Görünen adımda küfür, hakaret ya da başkasını taklit eden bir ad kullanmayacağım.',
    start: 'Kabul et ve devam et',
    ruleMissing: 'Devam etmek için kuralı onayla.',
    emptyTitle: 'Henüz arkadaşın yok',
    emptyText: 'Bir arkadaşınla yan yana gel, biriniz kodunu göstersin, diğeri okutsun. Hepsi bu.',
    noMoment: 'Şu an bir an seçmedi',
    moodHidden: 'Ruh halini gizli tutuyor',
    same: 'Seninle aynı',
    muted: 'Sessizde',
    count: (n: number) => `${n} / ${FRIEND_LIMIT}`,
    loadError: 'Liste yüklenemedi. Aşağı çekip yenile.',
    mute: 'Bildirimlerini sessize al',
    unmute: 'Sessizden çıkar',
    muteSub: (n: string) => `${n} seninle aynı anı yaşadığında haber gelmez.`,
    remove: 'Arkadaşlıktan çıkar',
    removeSub: (_n: string) => 'İkinizin listesinden de anında silinir. Karşı tarafa bildirim gitmez.',
    removeAsk: (n: string) => `${n} çıkarılsın mı?`,
    removeAskText: 'İkinizin listesinden de silinir. Tekrar eklemek için yan yana QR okutmanız gerekir.',
    removeYes: 'Çıkar',
    report: 'Şikayet et',
    reportSub: (n: string) => `Bir neden seçersin, ${n} listenden çıkarılır.`,
    reportTitle: (_n: string) => 'Neden şikayet ediyorsun?',
    reportText: (_n: string) => 'Şikayetin 24 saat içinde incelenir. Kimin şikayet ettiği söylenmez.',
    reasons: {
      name: 'Görünen adı uygunsuz',
      harassment: 'Uygulama dışında beni rahatsız ediyor',
      other: 'Başka bir neden',
    } as Record<ReportReason, string>,
    reportYes: 'Şikayet et ve çıkar',
    reportDone: 'Şikayetin alındı',
    reportDoneText: 'Teşekkürler. 24 saat içinde inceleyeceğiz.',
    cancel: 'Vazgeç',
    error: 'Bir sorun oluştu',
    errorText: 'Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.',
    ok: 'Tamam',
  },
  en: {
    title: 'Friends',
    lead: "Your friends' current moments. Only people you've paired with side by side appear here.",
    qr: 'Add with QR',
    setupTitle: 'Two quick steps first',
    setupText: 'Your friends only see your current moment. No chat, no history.',
    step1: '1. Choose your display name',
    step1Sub: "It doesn't have to be your real name. Only your friends see it.",
    namePh: 'e.g. Alex or Coffee 🐱',
    step2: '2. Our one rule',
    rule: "I won't use swear words, insults or someone else's identity in my display name.",
    start: 'Agree and continue',
    ruleMissing: 'Accept the rule to continue.',
    emptyTitle: 'No friends yet',
    emptyText: 'Get together with a friend: one of you shows the code, the other scans it. That\'s it.',
    noMoment: "Hasn't picked a moment",
    moodHidden: 'Keeps their mood private',
    same: 'Same as you',
    muted: 'Muted',
    count: (n: number) => `${n} / ${FRIEND_LIMIT}`,
    loadError: "Couldn't load the list. Pull down to refresh.",
    mute: 'Mute notifications',
    unmute: 'Unmute',
    muteSub: (n: string) => `You won't be notified when ${n} shares your moment.`,
    remove: 'Remove friend',
    removeSub: (n: string) => `Removed from both lists right away. ${n} won't be notified.`,
    removeAsk: (n: string) => `Remove ${n}?`,
    removeAskText: "You'll be removed from each other's lists. To add again, scan a QR code side by side.",
    removeYes: 'Remove',
    report: 'Report',
    reportSub: (n: string) => `Pick a reason; ${n} will be removed from your list.`,
    reportTitle: (n: string) => `Why are you reporting ${n}?`,
    reportText: (n: string) => `We review reports within 24 hours. ${n} won't be told who reported.`,
    reasons: {
      name: 'Inappropriate display name',
      harassment: 'Bothering me outside the app',
      other: 'Another reason',
    } as Record<ReportReason, string>,
    reportYes: 'Report and remove',
    reportDone: 'Report received',
    reportDoneText: "Thanks. We'll review it within 24 hours.",
    cancel: 'Cancel',
    error: 'Something went wrong',
    errorText: "Couldn't connect. Check your internet and try again.",
    ok: 'OK',
  },
};

const REFRESH_MS = 30000;

export function FriendsTab({
  lang,
  topInset,
  bottomSpace,
  bottomInset,
  me,
  onMeChange,
  myActivityId,
  activityInfo,
}: {
  lang: Lang;
  topInset: number;
  bottomSpace: number;
  bottomInset: number;
  me: Me;
  onMeChange: (next: Me) => void;
  myActivityId: string | null;
  activityInfo: (id: string) => ActivityInfo | null;
}) {
  const t = T[lang];
  const [setup, setSetup] = useState<boolean | null>(null);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mutes, setMutes] = useState<string[]>([]);
  const [qrOpen, setQrOpen] = useState(false);
  const [actionFor, setActionFor] = useState<Friend | null>(null);
  const [reportFor, setReportFor] = useState<Friend | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await getFriends();
      setFriends(list);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const [s, m] = await Promise.all([isFriendsSetup(), loadMutes()]);
      setMutes(m);
      setSetup(s);
      if (s) load();
    })();
  }, [load]);

  // Sekme açıkken 30 saniyede bir ve uygulamaya geri dönülünce yenile
  useEffect(() => {
    if (!setup) return;
    const id = setInterval(() => {
      if (AppState.currentState === 'active') load();
    }, REFRESH_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') load();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [setup, load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function showError() {
    Alert.alert(t.error, t.errorText, [{ text: t.ok }]);
  }

  function toggleMute(f: Friend) {
    const next = mutes.includes(f.id) ? mutes.filter((x) => x !== f.id) : [...mutes, f.id];
    setMutes(next);
    saveMutes(next);
    setActionFor(null);
  }

  function askRemove(f: Friend) {
    setActionFor(null);
    setTimeout(() => {
      Alert.alert(t.removeAsk(f.name), t.removeAskText, [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.removeYes,
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFriend(f.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              setFriends((cur) => (cur ?? []).filter((x) => x.id !== f.id));
            } catch {
              showError();
            }
          },
        },
      ]);
    }, 300);
  }

  async function sendReport(f: Friend, reason: ReportReason) {
    setReportFor(null);
    try {
      await reportFriend(f.id, reason);
      setFriends((cur) => (cur ?? []).filter((x) => x.id !== f.id));
      setTimeout(() => Alert.alert(t.reportDone, t.reportDoneText, [{ text: t.ok }]), 300);
    } catch {
      showError();
    }
  }

  // ---- Yükleniyor ----
  if (setup === null) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar style="dark" />
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  // ---- İlk açılış ----
  if (!setup) {
    return (
      <Onboarding
        lang={lang}
        me={me}
        topInset={topInset}
        bottomSpace={bottomSpace}
        onDone={(name) => {
          onMeChange({ ...me, displayName: name });
          setSetup(true);
          setFriends([]);
          load();
        }}
      />
    );
  }

  const list = friends ?? [];

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topInset + 16, paddingBottom: bottomSpace }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
      >
        <View style={styles.headRow}>
          <Text style={styles.title}>{t.title}</Text>
          <Pressable
            style={styles.qrBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setQrOpen(true);
            }}
            accessibilityRole="button"
          >
            <Ionicons name="qr-code-outline" size={17} color="#FFFFFF" />
            <Text style={styles.qrText}>{t.qr}</Text>
          </Pressable>
        </View>
        <View style={styles.leadRow}>
          <Text style={[styles.lead, { flex: 1 }]}>{t.lead}</Text>
          {friends ? <Text style={styles.countText}>{t.count(list.length)}</Text> : null}
        </View>

        {loadFailed ? <Text style={styles.loadError}>{t.loadError}</Text> : null}

        {friends === null && !loadFailed ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 30 }} />
        ) : list.length === 0 && !loadFailed ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="people-outline" size={30} color={ACCENT} />
            </View>
            <Text style={styles.emptyTitle}>{t.emptyTitle}</Text>
            <Text style={styles.emptyText}>{t.emptyText}</Text>
          </View>
        ) : (
          list.map((f) => {
            const info = f.activityId ? activityInfo(f.activityId) : null;
            const same = !!f.activityId && f.activityId === myActivityId;
            const isMuted = mutes.includes(f.id);
            return (
              <Pressable
                key={f.id}
                style={styles.row}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setActionFor(f);
                }}
                accessibilityRole="button"
              >
                <Avatar name={f.name} />
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {f.name}
                    </Text>
                    {isMuted ? <Ionicons name="notifications-off-outline" size={14} color={MUTED} /> : null}
                  </View>
                  {info ? (
                    <View style={styles.statusRow}>
                      <info.Icon size={15} color={info.fg} weight="duotone" />
                      <Text style={styles.status} numberOfLines={1}>
                        {info.name}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.statusMuted} numberOfLines={1}>
                      {f.moodHidden ? t.moodHidden : t.noMoment}
                    </Text>
                  )}
                </View>
                {same ? (
                  <View style={styles.samePill}>
                    <Text style={styles.sameText}>{t.same}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
      <View style={[styles.statusShade, { height: topInset }]} pointerEvents="none" />

      <QrSheet
        visible={qrOpen}
        lang={lang}
        friendCount={list.length}
        bottomInset={bottomInset}
        onClose={() => setQrOpen(false)}
        onAdded={() => load()}
      />

      {/* Arkadaş işlemleri */}
      <Sheet visible={!!actionFor} onClose={() => setActionFor(null)} bottomInset={bottomInset}>
        {actionFor ? (
          <>
            <View style={styles.sheetHead}>
              <Avatar name={actionFor.name} />
              <Text style={styles.sheetName}>{actionFor.name}</Text>
            </View>
            <SheetOption
              icon={mutes.includes(actionFor.id) ? 'notifications-outline' : 'notifications-off-outline'}
              title={mutes.includes(actionFor.id) ? t.unmute : t.mute}
              sub={mutes.includes(actionFor.id) ? undefined : t.muteSub(actionFor.name)}
              onPress={() => toggleMute(actionFor)}
            />
            <SheetOption
              icon="person-remove-outline"
              title={t.remove}
              sub={t.removeSub(actionFor.name)}
              danger
              onPress={() => askRemove(actionFor)}
            />
            <SheetOption
              icon="flag-outline"
              title={t.report}
              sub={t.reportSub(actionFor.name)}
              danger
              onPress={() => {
                const f = actionFor;
                setActionFor(null);
                setTimeout(() => setReportFor(f), 350);
              }}
            />
            <Pressable style={styles.ghostBtn} onPress={() => setActionFor(null)}>
              <Text style={styles.ghostText}>{t.cancel}</Text>
            </Pressable>
          </>
        ) : null}
      </Sheet>

      {/* Şikayet nedeni */}
      <ReportSheet
        lang={lang}
        friend={reportFor}
        bottomInset={bottomInset}
        onClose={() => setReportFor(null)}
        onSend={sendReport}
      />
    </View>
  );
}

// ---- İlk açılış: görünen ad + kural ----
function Onboarding({
  lang,
  me,
  topInset,
  bottomSpace,
  onDone,
}: {
  lang: Lang;
  me: Me;
  topInset: number;
  bottomSpace: number;
  onDone: (name: string) => void;
}) {
  const t = T[lang];
  const [name, setName] = useState(me.displayName ?? '');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const len = nameLength(cleanDisplayName(name));

  async function start() {
    const c = checkDisplayName(name);
    if (c !== 'ok') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setError(nameError(c, lang));
      return;
    }
    if (!agreed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setError(t.ruleMissing);
      return;
    }
    setSaving(true);
    try {
      const clean = cleanDisplayName(name);
      await setupFriends(clean, !!me.moodShare);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onDone(clean);
    } catch {
      setError(T[lang].errorText);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topInset + 16, paddingBottom: bottomSpace }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t.title}</Text>
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="people-outline" size={30} color={ACCENT} />
          </View>
          <Text style={styles.emptyTitle}>{t.setupTitle}</Text>
          <Text style={styles.emptyText}>{t.setupText}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.step1}</Text>
          <Text style={styles.cardSub}>{t.step1Sub}</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={(v) => {
                setName(v);
                if (error) setError('');
              }}
              placeholder={t.namePh}
              placeholderTextColor="#9A9EA8"
              autoCorrect={false}
              maxLength={40}
              returnKeyType="done"
            />
            <Text style={[styles.counter, len > NAME_MAX && { color: DANGER }]}>
              {len}/{NAME_MAX}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.step2}</Text>
          <Pressable
            style={styles.ruleRow}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setAgreed((v) => !v);
              if (error) setError('');
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
              {agreed ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
            </View>
            <Text style={styles.ruleText}>{t.rule}</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.formError}>{error}</Text> : null}

        <Pressable style={[styles.primaryBtn, saving && { opacity: 0.7 }]} onPress={start} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{t.start}</Text>}
        </Pressable>
      </ScrollView>
      <View style={[styles.statusShade, { height: topInset }]} pointerEvents="none" />
    </View>
  );
}

// ---- Şikayet nedeni ----
function ReportSheet({
  lang,
  friend,
  bottomInset,
  onClose,
  onSend,
}: {
  lang: Lang;
  friend: Friend | null;
  bottomInset: number;
  onClose: () => void;
  onSend: (f: Friend, reason: ReportReason) => void;
}) {
  const t = T[lang];
  const [reason, setReason] = useState<ReportReason>('name');
  const last = useRef<Friend | null>(null);
  if (friend) last.current = friend;
  const f = friend ?? last.current;

  useEffect(() => {
    if (friend) setReason('name');
  }, [friend]);

  return (
    <Sheet visible={!!friend} onClose={onClose} bottomInset={bottomInset}>
      {f ? (
        <>
          <Text style={styles.reportTitle}>{t.reportTitle(f.name)}</Text>
          <Text style={styles.cardSub}>{t.reportText(f.name)}</Text>
          <View style={{ gap: 10, marginTop: 6 }}>
            {(['name', 'harassment', 'other'] as ReportReason[]).map((r) => {
              const on = reason === r;
              return (
                <Pressable
                  key={r}
                  style={[styles.reason, on && styles.reasonOn]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setReason(r);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                  <Text style={styles.reasonText}>{t.reasons[r]}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={[styles.dangerBtn, { marginTop: 14 }]} onPress={() => friend && onSend(friend, reason)}>
            <Text style={styles.primaryText}>{t.reportYes}</Text>
          </Pressable>
          <Pressable style={[styles.ghostBtn, { marginTop: 10 }]} onPress={onClose}>
            <Text style={styles.ghostText}>{t.cancel}</Text>
          </Pressable>
        </>
      ) : null}
    </Sheet>
  );
}

// ---- Ortak alttan açılan panel ----
function Sheet({
  visible,
  onClose,
  bottomInset,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  bottomInset: number;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.sheetWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: 22 + bottomInset }]}>
          <View style={styles.grabber} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

function SheetOption({
  icon,
  title,
  sub,
  danger,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const color = danger ? DANGER : INK;
  return (
    <Pressable style={styles.option} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icon} size={22} color={danger ? DANGER : SOFT} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.optionTitle, { color }]}>{title}</Text>
        {sub ? <Text style={styles.optionSub}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  statusShade: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: BG },
  content: { paddingHorizontal: 20, gap: 14 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: F.bold, fontSize: 28, color: INK, letterSpacing: -0.3 },
  qrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: ACCENT,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 999,
    minHeight: 40,
  },
  qrText: { fontFamily: F.bold, fontSize: 14, color: '#FFFFFF' },
  leadRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  lead: { fontFamily: F.regular, fontSize: 13, lineHeight: 18, color: SOFT },
  countText: { fontFamily: F.medium, fontSize: 13, color: MUTED },
  loadError: { fontFamily: F.medium, fontSize: 13, color: DANGER },

  empty: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 10,
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
  emptyTitle: { fontFamily: F.bold, fontSize: 17, color: INK, textAlign: 'center' },
  emptyText: { fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: SOFT, textAlign: 'center' },

  row: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: F.bold, fontSize: 15, color: INK, flexShrink: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  status: { fontFamily: F.regular, fontSize: 13, color: INK, flexShrink: 1 },
  statusMuted: { fontFamily: F.regular, fontSize: 13, color: MUTED },
  samePill: { backgroundColor: '#E6ECFF', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999 },
  sameText: { fontFamily: F.bold, fontSize: 12, color: ACCENT },

  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 8 },
  cardTitle: { fontFamily: F.bold, fontSize: 15, color: INK },
  cardSub: { fontFamily: F.regular, fontSize: 13, lineHeight: 18, color: SOFT },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: ACCENT,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  input: { flex: 1, fontFamily: F.medium, fontSize: 17, color: INK, paddingVertical: 12 },
  counter: { fontFamily: F.medium, fontSize: 12, color: MUTED },
  ruleRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 4 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#B9BCC6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  ruleText: { flex: 1, fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: INK },
  formError: { fontFamily: F.medium, fontSize: 13, color: DANGER, marginLeft: 4 },
  primaryBtn: { backgroundColor: ACCENT, borderRadius: 16, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: F.bold, fontSize: 16, color: '#FFFFFF' },
  dangerBtn: { backgroundColor: DANGER, borderRadius: 16, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  ghostBtn: { backgroundColor: '#F0F1F4', borderRadius: 16, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  ghostText: { fontFamily: F.bold, fontSize: 16, color: INK },

  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,14,28,0.45)' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#D9DBE1', marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 6 },
  sheetName: { fontFamily: F.bold, fontSize: 18, color: INK },
  option: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEFF2',
    minHeight: 52,
  },
  optionTitle: { fontFamily: F.bold, fontSize: 16 },
  optionSub: { fontFamily: F.regular, fontSize: 13, lineHeight: 18, color: SOFT },
  reportTitle: { fontFamily: F.bold, fontSize: 20, color: INK, marginBottom: 4 },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#E1E3E9',
    borderRadius: 16,
    padding: 14,
    minHeight: 52,
  },
  reasonOn: { borderColor: ACCENT },
  reasonText: { flex: 1, fontFamily: F.bold, fontSize: 15, color: INK },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#B9BCC6', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: ACCENT },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: ACCENT },
});

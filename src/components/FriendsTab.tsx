// Arkadaşlar sekmesi: ilk açılış (görünen ad + tek kural), arkadaş listesi, QR ile ekleme,
// sessize alma, arkadaşlıktan çıkarma ve şikayet. Arkadaşlar sadece birbirinin ŞU ANKİ anını görür.
// 1.5.0: "Sor" düğmesi (şu an bir an seçmemiş arkadaşa "Şu an ne yapıyorsun?" bildirimi) ve
// listenin altında "Arkadaşlarım bana sorabilsin" ayarı.
// 1.5.1: link / kod ile davet (uzaktaki arkadaş). Kodu kullanan kişi istek gönderir,
// davet eden onaylarsa arkadaş olurlar. Bekleyen istekler ve aktif davet listenin üstünde.
import { ComponentType, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
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
  TERMS_URLS,
} from '@/lib/friends';
import { checkDisplayName, cleanDisplayName, Me, NAME_MAX, nameError, nameLength } from '@/lib/me';
import { Avatar, QrSheet } from '@/components/QrSheet';
import { whenOverlayFree } from '@/lib/overlay';
import { AskResult, getAllowAsks, recentAsks, sendAsk, setAllowAsks } from '@/lib/ask';
import {
  cancelSentRequest,
  cleanCode,
  createInvite,
  CreateInviteResult,
  decideInviteRequest,
  enableInviteNotifications,
  getInviteRequests,
  getMyInvites,
  getSentRequests,
  Invite,
  inviteMessage,
  InviteRequest,
  isValidCode,
  onInviteCode,
  onInvitesChanged,
  requestInvite,
  RequestInviteResult,
  revokeInvite,
  SentRequest,
  shareInviteOther,
  shareInviteWhatsApp,
} from '@/lib/invite';

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
    lead: 'Arkadaşlarının şu anki anları. Sadece senin onayladığın kişiler burada.',
    qr: 'QR ile ekle',
    link: 'Link ile davet et',
    setupTitle: 'Önce iki küçük adım',
    setupText: 'Arkadaşların sadece şu anki anını görür. Sohbet yok, geçmiş yok.',
    step1: '1. Görünen adını seç',
    step1Sub: 'Gerçek adın olması gerekmez. Sadece arkadaşların görür.',
    namePh: 'Örn. Ayşe ya da Kahve 🐱',
    step2: '2. Tek kuralımız',
    rule: 'Görünen adımda küfür, hakaret ya da başkasını taklit eden bir ad kullanmayacağım.',
    readTerms: 'Kullanım şartlarını oku',
    start: 'Kabul et ve devam et',
    ruleMissing: 'Devam etmek için kuralı onayla.',
    emptyTitle: 'Henüz arkadaşın yok',
    emptyText: 'Yan yanaysanız QR okutun. Uzaktaysa ona davet linki gönder.',
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
    removeAskText: 'İkinizin listesinden de silinir. Tekrar eklemek için QR ya da davet linki gerekir.',
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
    ask: 'Sor',
    asked: 'Soruldu',
    askDone: (n: string) => `Soru gitti. ${n} bir an seçince sana haber vereceğiz.`,
    askMsg: {
      cooldown: (_n: string) => 'Az önce sordun. Aynı kişiye 4 saatte bir sorabilirsin.',
      limit: (n: string) => `${n} bugün yeterince soru aldı. Yarın tekrar dene.`,
      off: (n: string) => `${n} soru almayı kapatmış.`,
      quiet: (n: string) => `${n} için şu an gece saati. Sabah 09:00'dan sonra sorabilirsin.`,
      no_device: (n: string) => `${n} bildirimlerini kapatmış, soru ulaşmıyor.`,
    } as Record<Exclude<AskResult, 'ok' | 'not_friend' | 'network'>, (n: string) => string>,
    allowTitle: 'Arkadaşlarım bana sorabilsin',
    allowSub: '"Şu an ne yapıyorsun?" bildirimi. Bir kişiye günde en fazla 3 soru, gece gelmez.',
    // Davet
    requestsHead: (n: number) => `BEKLEYEN İSTEKLER · ${n}`,
    requestSub: (ago: string) => `Davetine katıldı · ${ago}`,
    approve: 'Onayla',
    approved: (n: string) => `${n} artık arkadaşın 🎉`,
    rejectAsk: (n: string) => `${n} reddedilsin mi?`,
    rejectText: 'Karşı tarafa bildirim gitmez.',
    rejectYes: 'Reddet',
    activeHead: 'AKTİF DAVETİN',
    sentHead: (n: number) => `GÖNDERDİĞİN İSTEKLER · ${n}`,
    sentSub: (ago: string) => `Onay bekleniyor · ${ago}`,
    cancelReqAsk: 'İstek iptal edilsin mi?',
    cancelReqText: (n: string) => `${n} isteğini artık görmeyecek.`,
    cancelReqYes: 'İsteği iptal et',
    activeTitle: (u: number, m: number) => `${u} / ${m} kişi katıldı`,
    activeSub: (left: string) => `${left} geçerli`,
    share: 'Paylaş',
    revoke: 'İptal',
    revokeAsk: 'Davet iptal edilsin mi?',
    revokeText: 'Bu kod artık çalışmaz. Gelmiş istekler listende kalır.',
    friendsHead: 'ARKADAŞLARIN',
    haveCode: 'Davet kodum var',
    inviteReady: 'Davetin hazır 🎉',
    inviteReadySub: 'Linki gönder ya da kodu söyle.\n24 saat geçerli · en fazla 10 kişi',
    inviteCodeLabel: 'DAVET KODU',
    sendWhatsApp: "WhatsApp'ta gönder",
    sendOther: 'Başka yolla paylaş',
    inviteNote: 'Katılanlar sana istek olarak düşer.\nSen onaylamadan kimse arkadaşın olmaz.',
    inviteErr: {
      no_profile: 'Önce görünen adını seç.',
      limit_me: 'Arkadaş sınırına ulaştın (50).',
      daily_limit: 'Bugün yeterince davet oluşturdun. Yarın tekrar dene.',
      busy: 'Şu an kod üretilemedi. Biraz sonra tekrar dene.',
      network: 'Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.',
    } as Record<Exclude<CreateInviteResult, { ok: true }>['error'], string>,
    codeTitle: 'Davet kodun var mı?',
    codeSub: 'Arkadaşının gönderdiği 4 haneli kodu yaz (ör. K472).',
    codeSend: 'İstek gönder',
    codeHint: 'Yanlış kodu çok kez denersen 1 saat beklersin.',
    ownCodeTitle: 'Bu senin davet kodun 🙂',
    ownCodeText: 'Linki arkadaşına gönder. O açınca sana istek gelir, sen onaylarsın.',
    codeErr: {
      no_profile: 'Önce görünen adını seç.',
      too_many: 'Çok fazla deneme yaptın. 1 saat sonra tekrar dene.',
      not_found: 'Bu kod bulunamadı ya da süresi doldu.',
      full: 'Bu davet doldu. Arkadaşından yeni bir kod iste.',
      self: 'Bu senin kendi davet kodun.',
      already: 'Zaten arkadaşsınız.',
      pending: 'İsteğin zaten gönderildi, onay bekleniyor.',
      limit_me: 'Arkadaş sınırına ulaştın (50).',
      network: 'Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.',
    } as Record<Exclude<RequestInviteResult, { ok: true }>['error'], string>,
    sentTitle: 'İstek gönderildi ✓',
    sentText: (n: string) => `${n || 'Arkadaşın'} onaylayınca arkadaş olacaksınız. Onaylandığında sana haber vereceğiz 🔔`,
    decideErr: {
      not_found: 'Bu istek artık geçerli değil.',
      limit_me: 'Arkadaş sınırına ulaştın (50).',
      limit_them: 'Arkadaşının listesi dolu (50).',
      network: 'Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.',
    } as Record<'not_found' | 'limit_me' | 'limit_them' | 'network', string>,
    agoMin: (n: number) => (n < 1 ? 'az önce' : `${n} dk önce`),
    agoHour: (n: number) => `${n} sa önce`,
    leftHour: (n: number) => `${n} sa`,
    leftMin: (n: number) => `${n} dk`,
  },
  en: {
    title: 'Friends',
    lead: "Your friends' current moments. Only people you've approved appear here.",
    qr: 'Add with QR',
    link: 'Invite with link',
    setupTitle: 'Two quick steps first',
    setupText: 'Your friends only see your current moment. No chat, no history.',
    step1: '1. Choose your display name',
    step1Sub: "It doesn't have to be your real name. Only your friends see it.",
    namePh: 'e.g. Alex or Coffee 🐱',
    step2: '2. Our one rule',
    rule: "I won't use swear words, insults or someone else's identity in my display name.",
    readTerms: 'Read the terms of use',
    start: 'Agree and continue',
    ruleMissing: 'Accept the rule to continue.',
    emptyTitle: 'No friends yet',
    emptyText: "Side by side? Scan a QR code. Far away? Send them an invite link.",
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
    removeAskText: "You'll be removed from each other's lists. To add again, you'll need a QR code or an invite link.",
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
    ask: 'Ask',
    asked: 'Asked',
    askDone: (n: string) => `Sent. We'll let you know when ${n} picks a moment.`,
    askMsg: {
      cooldown: (_n: string) => 'You just asked. You can ask the same person every 4 hours.',
      limit: (n: string) => `${n} has had enough questions today. Try again tomorrow.`,
      off: (n: string) => `${n} has turned off questions.`,
      quiet: (n: string) => `It's night time for ${n}. You can ask after 9 am.`,
      no_device: (n: string) => `${n} has notifications off, so the question can't reach them.`,
    } as Record<Exclude<AskResult, 'ok' | 'not_friend' | 'network'>, (n: string) => string>,
    allowTitle: 'Let my friends ask me',
    allowSub: '"What are you doing right now?" notification. At most 3 a day, never at night.',
    requestsHead: (n: number) => `PENDING REQUESTS · ${n}`,
    requestSub: (ago: string) => `Joined your invite · ${ago}`,
    approve: 'Approve',
    approved: (n: string) => `${n} is now your friend 🎉`,
    rejectAsk: (n: string) => `Decline ${n}?`,
    rejectText: "They won't be notified.",
    rejectYes: 'Decline',
    activeHead: 'YOUR ACTIVE INVITE',
    sentHead: (n: number) => `REQUESTS YOU SENT · ${n}`,
    sentSub: (ago: string) => `Waiting for approval · ${ago}`,
    cancelReqAsk: 'Cancel this request?',
    cancelReqText: (n: string) => `${n} will no longer see your request.`,
    cancelReqYes: 'Cancel request',
    activeTitle: (u: number, m: number) => `${u} / ${m} joined`,
    activeSub: (left: string) => `Valid for ${left}`,
    share: 'Share',
    revoke: 'Cancel',
    revokeAsk: 'Cancel this invite?',
    revokeText: "This code will stop working. Requests you've received stay in your list.",
    friendsHead: 'YOUR FRIENDS',
    haveCode: 'I have an invite code',
    inviteReady: 'Your invite is ready 🎉',
    inviteReadySub: 'Send the link or tell them the code.\nValid for 24 hours · up to 10 people',
    inviteCodeLabel: 'INVITE CODE',
    sendWhatsApp: 'Send on WhatsApp',
    sendOther: 'Share another way',
    inviteNote: "People who join show up as requests.\nNo one becomes your friend until you approve.",
    inviteErr: {
      no_profile: 'Choose your display name first.',
      limit_me: "You've reached the friend limit (50).",
      daily_limit: "You've created enough invites today. Try again tomorrow.",
      busy: "Couldn't create a code right now. Try again in a bit.",
      network: "Couldn't connect. Check your internet and try again.",
    } as Record<Exclude<CreateInviteResult, { ok: true }>['error'], string>,
    codeTitle: 'Have an invite code?',
    codeSub: 'Enter the 4-character code your friend sent you (e.g. K472).',
    codeSend: 'Send request',
    codeHint: "Too many wrong codes and you'll need to wait an hour.",
    ownCodeTitle: 'This is your own invite code 🙂',
    ownCodeText: 'Send the link to a friend. When they open it, you get a request to approve.',
    codeErr: {
      no_profile: 'Choose your display name first.',
      too_many: 'Too many tries. Try again in an hour.',
      not_found: "This code wasn't found or has expired.",
      full: 'This invite is full. Ask your friend for a new code.',
      self: "That's your own invite code.",
      already: "You're already friends.",
      pending: 'Your request is already sent and waiting for approval.',
      limit_me: "You've reached the friend limit (50).",
      network: "Couldn't connect. Check your internet and try again.",
    } as Record<Exclude<RequestInviteResult, { ok: true }>['error'], string>,
    sentTitle: 'Request sent ✓',
    sentText: (n: string) => `You'll be friends once ${n || 'your friend'} approves. We'll let you know 🔔`,
    decideErr: {
      not_found: 'This request is no longer valid.',
      limit_me: "You've reached the friend limit (50).",
      limit_them: "Your friend's list is full (50).",
      network: "Couldn't connect. Check your internet and try again.",
    } as Record<'not_found' | 'limit_me' | 'limit_them' | 'network', string>,
    agoMin: (n: number) => (n < 1 ? 'just now' : `${n} min ago`),
    agoHour: (n: number) => `${n} h ago`,
    leftHour: (n: number) => `${n} h`,
    leftMin: (n: number) => `${n} min`,
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
  // Sor
  const [asked, setAsked] = useState<Record<string, number>>({});
  const [askingId, setAskingId] = useState<string | null>(null);
  const [allowAsks, setAllowAsksState] = useState(true);
  // Davet
  const [requests, setRequests] = useState<InviteRequest[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [creating, setCreating] = useState(false);
  const [inviteSheet, setInviteSheet] = useState<Invite | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeFromLink, setCodeFromLink] = useState(false); // linkten geldiyse klavye kendiliğinden açılmasın
  const [sentName, setSentName] = useState<string | null>(null);
  const [sent, setSent] = useState<SentRequest[]>([]);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const pendingCodeRef = useRef<string | null>(null);
  const invitesRef = useRef<Invite[]>([]);
  invitesRef.current = invites;

  const loadInvites = useCallback(async () => {
    const [rq, inv, sn] = await Promise.all([getInviteRequests(), getMyInvites(), getSentRequests()]);
    setRequests(rq);
    setInvites(inv);
    setSent(sn);
  }, []);

  // Davet ekranından istek gönderilince listeleri hemen yenile
  useEffect(() => onInvitesChanged(() => loadInvites().catch(() => {})), [loadInvites]);

  const load = useCallback(async () => {
    try {
      const list = await getFriends();
      setFriends(list);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
    loadInvites().catch(() => {});
  }, [loadInvites]);

  // Davet linkinden gelen kod: kurulum bittiyse kod panelini doldurup aç, bitmediyse sonra aç
  const setupRef = useRef<boolean | null>(null);
  setupRef.current = setup;
  useEffect(() => {
    return onInviteCode((c) => {
      if (setupRef.current) openCodeFromLink(c);
      else pendingCodeRef.current = c;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Linkten gelen kodu göster.
  // iPhone, ekran geçişi sürerken ya da başka bir panel açıkken yeni panel açılırsa onu göstermiyor.
  // Bu yüzden önce açık panelleri kapat, geçiş bitsin, diğer pencereler (Günün Sorusu, rozet) kapansın, sonra aç.
  const linkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function openCodeFromLink(c: string) {
    setInviteSheet(null);
    setQrOpen(false);
    setSentName(null);
    setActionFor(null);
    setReportFor(null);
    setCodeOpen(false);
    if (linkTimer.current) clearTimeout(linkTimer.current);
    linkTimer.current = setTimeout(() => {
      whenOverlayFree(() => {
        // Kendi linkine dokunduysa kod panelini açma, ne yapacağını söyle
        if (invitesRef.current.some((i) => i.code === c)) {
          Alert.alert(t.ownCodeTitle, t.ownCodeText, [{ text: t.ok }]);
          return;
        }
        setCode(c);
        setCodeError('');
        setCodeFromLink(true);
        setCodeOpen(true);
      });
    }, 800);
  }
  useEffect(
    () => () => {
      if (linkTimer.current) clearTimeout(linkTimer.current);
    },
    [],
  );

  useEffect(() => {
    (async () => {
      const [s, m] = await Promise.all([isFriendsSetup(), loadMutes()]);
      setMutes(m);
      setSetup(s);
      if (s) load();
      recentAsks().then(setAsked).catch(() => {});
      getAllowAsks().then(setAllowAsksState).catch(() => {});
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

  async function ask(f: Friend) {
    if (askingId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAskingId(f.id);
    const r = await sendAsk(f.id);
    setAskingId(null);
    if (r === 'ok') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setAsked((cur) => ({ ...cur, [f.id]: Date.now() }));
      Alert.alert(t.ask, t.askDone(f.name), [{ text: t.ok }]);
      return;
    }
    if (r === 'cooldown') setAsked((cur) => ({ ...cur, [f.id]: Date.now() }));
    if (r === 'not_friend' || r === 'network') {
      showError();
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert(t.ask, t.askMsg[r](f.name), [{ text: t.ok }]);
  }

  async function toggleAllowAsks(next: boolean) {
    Haptics.selectionAsync().catch(() => {});
    setAllowAsksState(next);
    const ok = await setAllowAsks(next);
    if (!ok) {
      setAllowAsksState(!next);
      showError();
    }
  }

  // ---- Davet ----
  async function newInvite() {
    if (creating) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Biri davete katılınca bildirim gelsin: izin yoksa iste, cihazı kaydet
    enableInviteNotifications();
    // Hâlâ geçerli ve dolmamış bir davet varsa yenisini üretmek yerine onu göster
    const live = invites.find((i) => i.expiresAt > Date.now() && i.uses < i.maxUses);
    if (live) {
      setInviteSheet(live);
      return;
    }
    setCreating(true);
    const r = await createInvite();
    setCreating(false);
    if ('error' in r) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      Alert.alert(t.link, t.inviteErr[r.error], [{ text: t.ok }]);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const inv = (r as { ok: true; invite: Invite }).invite;
    setInvites((cur) => [inv, ...cur]);
    setInviteSheet(inv);
  }

  function askRevoke(inv: Invite) {
    Alert.alert(t.revokeAsk, t.revokeText, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.revoke,
        style: 'destructive',
        onPress: async () => {
          const ok = await revokeInvite(inv.id);
          if (!ok) return showError();
          setInvites((cur) => cur.filter((x) => x.id !== inv.id));
        },
      },
    ]);
  }

  async function decide(rq: InviteRequest, accept: boolean) {
    if (decidingId) return;
    setDecidingId(rq.id);
    const r = await decideInviteRequest(rq.id, accept);
    setDecidingId(null);
    if ('error' in r) {
      Alert.alert(t.error, t.decideErr[r.error], [{ text: t.ok }]);
      loadInvites().catch(() => {});
      return;
    }
    setRequests((cur) => cur.filter((x) => x.id !== rq.id));
    if (accept) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(t.approve, t.approved(rq.name), [{ text: t.ok }]);
      load();
    }
  }

  function askReject(rq: InviteRequest) {
    Alert.alert(t.rejectAsk(rq.name), t.rejectText, [
      { text: t.cancel, style: 'cancel' },
      { text: t.rejectYes, style: 'destructive', onPress: () => decide(rq, false) },
    ]);
  }

  function openCode() {
    Haptics.selectionAsync().catch(() => {});
    setCode('');
    setCodeError('');
    setCodeFromLink(false);
    setCodeOpen(true);
  }

  async function sendCode() {
    const c = cleanCode(code);
    if (!isValidCode(c)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setCodeError(t.codeErr.not_found);
      return;
    }
    setCodeBusy(true);
    // Arkadaşın onaylayınca bildirim gelsin
    await enableInviteNotifications();
    const r = await requestInvite(c);
    setCodeBusy(false);
    if ('error' in r) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setCodeError(t.codeErr[r.error]);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCodeOpen(false);
    const joinedName = (r as { ok: true; name: string }).name;
    loadInvites().catch(() => {});
    // iPhone: kod paneli kapanırken yenisi açılırsa görünmüyordu; kapanma bitsin, sonra aç
    setTimeout(() => whenOverlayFree(() => setSentName(joinedName)), 700);
  }

  function askCancelSent(rq: SentRequest) {
    Alert.alert(t.cancelReqAsk, t.cancelReqText(rq.name), [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.cancelReqYes,
        style: 'destructive',
        onPress: async () => {
          setCancelingId(rq.id);
          const ok = await cancelSentRequest(rq.id);
          setCancelingId(null);
          if (ok) setSent((cur) => cur.filter((x) => x.id !== rq.id));
          else showError();
        },
      },
    ]);
  }

  function ago(ms: number) {
    const min = Math.floor((Date.now() - ms) / 60000);
    return min < 60 ? t.agoMin(min) : t.agoHour(Math.floor(min / 60));
  }
  function left(ms: number) {
    const min = Math.max(0, Math.floor((ms - Date.now()) / 60000));
    return min >= 60 ? t.leftHour(Math.floor(min / 60)) : t.leftMin(min);
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
          if (pendingCodeRef.current) {
            const c = pendingCodeRef.current;
            pendingCodeRef.current = null;
            openCodeFromLink(c);
          }
        }}
      />
    );
  }

  const list = friends ?? [];
  const activeInvite = invites.find((i) => i.expiresAt > Date.now()) ?? null;

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
          {friends ? <Text style={styles.countText}>{t.count(list.length)}</Text> : null}
        </View>
        <Text style={styles.lead}>{t.lead}</Text>
        <View style={styles.addRow}>
          <Pressable
            style={({ pressed }) => [styles.addBtn, styles.addBtnOutline, pressed && { opacity: 0.85 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setQrOpen(true);
            }}
            accessibilityRole="button"
          >
            <Ionicons name="qr-code-outline" size={17} color={ACCENT} />
            <Text style={[styles.addText, { color: ACCENT }]}>{t.qr}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
            onPress={newInvite}
            disabled={creating}
            accessibilityRole="button"
          >
            {creating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="link-outline" size={18} color="#FFFFFF" />
                <Text style={styles.addText}>{t.link}</Text>
              </>
            )}
          </Pressable>
        </View>

        {requests.length > 0 ? (
          <>
            <Text style={styles.sectionHead}>{t.requestsHead(requests.length)}</Text>
            {requests.map((rq) => (
              <View key={rq.id} style={[styles.row, styles.requestRow]}>
                <Avatar name={rq.name} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {rq.name}
                  </Text>
                  <Text style={styles.statusMuted} numberOfLines={1}>
                    {t.requestSub(ago(rq.createdAt))}
                  </Text>
                </View>
                {decidingId === rq.id ? (
                  <ActivityIndicator color={ACCENT} />
                ) : (
                  <>
                    <Pressable
                      style={({ pressed }) => [styles.askBtn, pressed && { opacity: 0.85 }]}
                      onPress={() => decide(rq, true)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`${t.approve}: ${rq.name}`}
                    >
                      <Text style={styles.askText}>{t.approve}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.xBtn}
                      onPress={() => askReject(rq)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`${t.rejectYes}: ${rq.name}`}
                    >
                      <Ionicons name="close" size={18} color={MUTED} />
                    </Pressable>
                  </>
                )}
              </View>
            ))}
          </>
        ) : null}

        {sent.length > 0 ? (
          <>
            <Text style={styles.sectionHead}>{t.sentHead(sent.length)}</Text>
            {sent.map((rq) => (
              <View key={rq.id} style={styles.row}>
                <Avatar name={rq.name} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {rq.name}
                  </Text>
                  <Text style={styles.statusMuted} numberOfLines={1}>
                    {t.sentSub(ago(rq.createdAt))}
                  </Text>
                </View>
                {cancelingId === rq.id ? (
                  <ActivityIndicator color={ACCENT} />
                ) : (
                  <Pressable
                    style={styles.smallBtn}
                    onPress={() => askCancelSent(rq)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.cancelReqYes}: ${rq.name}`}
                  >
                    <Text style={styles.smallBtnText}>{t.revoke}</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </>
        ) : null}

        {activeInvite ? (
          <>
            <Text style={styles.sectionHead}>{t.activeHead}</Text>
            <View style={styles.row}>
              <View style={styles.codeBadge}>
                <Text style={styles.codeBadgeText}>{activeInvite.code}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {t.activeTitle(activeInvite.uses, activeInvite.maxUses)}
                </Text>
                <Text style={styles.statusMuted}>{t.activeSub(left(activeInvite.expiresAt))}</Text>
              </View>
              <Pressable style={styles.smallBtn} onPress={() => setInviteSheet(activeInvite)} hitSlop={6}>
                <Text style={styles.smallBtnText}>{t.share}</Text>
              </Pressable>
              <Pressable style={styles.smallBtn} onPress={() => askRevoke(activeInvite)} hitSlop={6}>
                <Text style={styles.smallBtnText}>{t.revoke}</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {(requests.length > 0 || sent.length > 0 || activeInvite) && list.length > 0 ? (
          <Text style={styles.sectionHead}>{t.friendsHead}</Text>
        ) : null}

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
                ) : !f.activityId && !f.moodHidden ? (
                  asked[f.id] ? (
                    <View style={styles.askedPill}>
                      <Ionicons name="checkmark" size={14} color={MUTED} />
                      <Text style={styles.askedText}>{t.asked}</Text>
                    </View>
                  ) : (
                    <Pressable
                      style={({ pressed }) => [styles.askBtn, pressed && { opacity: 0.85 }]}
                      onPress={() => ask(f)}
                      disabled={!!askingId}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`${t.ask}: ${f.name}`}
                    >
                      {askingId === f.id ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.askText}>{t.ask} 👀</Text>
                      )}
                    </Pressable>
                  )
                ) : null}
              </Pressable>
            );
          })
        )}

        {friends && list.length > 0 ? (
          <View style={styles.allowCard}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.cardTitle}>{t.allowTitle}</Text>
              <Text style={styles.cardSub}>{t.allowSub}</Text>
            </View>
            <Switch
              value={allowAsks}
              onValueChange={toggleAllowAsks}
              trackColor={{ false: '#D9DBE1', true: ACCENT }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#D9DBE1"
            />
          </View>
        ) : null}

        <Pressable onPress={openCode} hitSlop={10} style={{ alignSelf: 'center', paddingVertical: 6 }} accessibilityRole="button">
          <Text style={styles.link}>{t.haveCode}</Text>
        </Pressable>
      </ScrollView>
      <View style={[styles.statusShade, { height: topInset }]} pointerEvents="none" />

      {/* Davet hazır: paylaş */}
      <Sheet visible={!!inviteSheet} onClose={() => setInviteSheet(null)} bottomInset={bottomInset}>
        {inviteSheet ? (
          <>
            <Text style={[styles.reportTitle, { textAlign: 'center' }]}>{t.inviteReady}</Text>
            <Text style={[styles.cardSub, { textAlign: 'center' }]}>{t.inviteReadySub}</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>{t.inviteCodeLabel}</Text>
              <Text style={styles.codeBig}>{inviteSheet.code}</Text>
            </View>
            <Pressable
              style={[styles.primaryBtn, styles.waBtn]}
              onPress={() => shareInviteWhatsApp(inviteMessage(inviteSheet.code, me.displayName ?? undefined, lang))}
              accessibilityRole="button"
            >
              <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
              <Text style={styles.primaryText}>{t.sendWhatsApp}</Text>
            </Pressable>
            <Pressable
              style={styles.ghostBtn}
              onPress={() => shareInviteOther(inviteMessage(inviteSheet.code, me.displayName ?? undefined, lang))}
              accessibilityRole="button"
            >
              <Text style={styles.ghostText}>{t.sendOther}</Text>
            </Pressable>
            <Text style={styles.sheetNote}>{t.inviteNote}</Text>
          </>
        ) : null}
      </Sheet>

      {/* Davet kodu gir */}
      <Sheet visible={codeOpen} onClose={() => setCodeOpen(false)} bottomInset={bottomInset}>
        <Text style={styles.reportTitle}>{t.codeTitle}</Text>
        <Text style={styles.cardSub}>{t.codeSub}</Text>
        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={(v) => {
            setCode(cleanCode(v));
            if (codeError) setCodeError('');
          }}
          placeholder="K472"
          placeholderTextColor="#C5C8D2"
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus={!codeFromLink}
          maxLength={4}
          returnKeyType="send"
          onSubmitEditing={sendCode}
        />
        {codeError ? <Text style={[styles.formError, { textAlign: 'center', marginLeft: 0 }]}>{codeError}</Text> : null}
        <Pressable
          style={[styles.primaryBtn, { marginTop: 12 }, (codeBusy || code.length < 4) && { opacity: 0.6 }]}
          onPress={sendCode}
          disabled={codeBusy || code.length < 4}
          accessibilityRole="button"
        >
          {codeBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{t.codeSend}</Text>}
        </Pressable>
        <Pressable style={styles.ghostBtn} onPress={() => setCodeOpen(false)}>
          <Text style={styles.ghostText}>{t.cancel}</Text>
        </Pressable>
        <Text style={styles.sheetNote}>{t.codeHint}</Text>
      </Sheet>

      {/* İstek gönderildi */}
      <Sheet visible={sentName !== null} onClose={() => setSentName(null)} bottomInset={bottomInset}>
        <View style={{ alignItems: 'center', gap: 10, paddingTop: 4 }}>
          <Avatar name={sentName || '?'} />
          <Text style={[styles.reportTitle, { textAlign: 'center' }]}>{t.sentTitle}</Text>
          <Text style={[styles.emptyText, { paddingHorizontal: 6 }]}>{t.sentText(sentName || '')}</Text>
        </View>
        <Pressable style={[styles.primaryBtn, { marginTop: 18 }]} onPress={() => setSentName(null)}>
          <Text style={styles.primaryText}>{t.ok}</Text>
        </Pressable>
      </Sheet>

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
          <Pressable
            onPress={() => Linking.openURL(TERMS_URLS[lang]).catch(() => {})}
            accessibilityRole="link"
            hitSlop={8}
            style={{ alignSelf: 'flex-start', marginLeft: 36 }}
          >
            <Text style={styles.link}>{t.readTerms}</Text>
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
      {/* Klavye açılınca panel yukarı kalksın (davet kodu yazarken alan klavyenin altında kalıyordu) */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheetWrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <View style={[styles.sheet, { paddingBottom: 22 + bottomInset }]}>
            <View style={styles.grabber} />
            {children}
          </View>
        </View>
      </KeyboardAvoidingView>
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
  addRow: { flexDirection: 'row', gap: 10 },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: ACCENT,
    borderRadius: 14,
    minHeight: 46,
    paddingHorizontal: 10,
  },
  addBtnOutline: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: ACCENT },
  addText: { fontFamily: F.bold, fontSize: 14, color: '#FFFFFF' },
  sectionHead: { fontFamily: F.bold, fontSize: 12, letterSpacing: 1, color: MUTED, marginTop: 6, marginLeft: 4, marginBottom: -4 },
  requestRow: { borderWidth: 1.5, borderColor: '#C7D2FE' },
  xBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F1F4', alignItems: 'center', justifyContent: 'center' },
  codeBadge: { minWidth: 58, height: 44, borderRadius: 12, backgroundColor: '#E6ECFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  codeBadgeText: { fontFamily: F.bold, fontSize: 16, letterSpacing: 1, color: ACCENT },
  smallBtn: { backgroundColor: '#F0F1F4', height: 32, paddingHorizontal: 12, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  smallBtnText: { fontFamily: F.bold, fontSize: 13, color: INK },
  codeBox: {
    marginTop: 16,
    marginBottom: 4,
    backgroundColor: '#F6F7FF',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#A5B4FC',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  codeLabel: { fontFamily: F.bold, fontSize: 12, letterSpacing: 1.2, color: MUTED },
  codeBig: { fontFamily: F.bold, fontSize: 48, letterSpacing: 10, color: ACCENT, marginTop: 2 },
  waBtn: { flexDirection: 'row', gap: 8, backgroundColor: '#25D366', marginTop: 12 },
  sheetNote: { fontFamily: F.regular, fontSize: 12.5, lineHeight: 18, color: MUTED, textAlign: 'center', marginTop: 12 },
  codeInput: {
    marginTop: 16,
    borderWidth: 2,
    borderColor: ACCENT,
    backgroundColor: '#F6F7FF',
    borderRadius: 18,
    paddingVertical: 14,
    textAlign: 'center',
    fontFamily: F.bold,
    fontSize: 40,
    letterSpacing: 14,
    color: ACCENT,
  },
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
  askBtn: {
    backgroundColor: ACCENT,
    minWidth: 72,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askText: { fontFamily: F.bold, fontSize: 14, color: '#FFFFFF' },
  askedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F1F4',
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  askedText: { fontFamily: F.bold, fontSize: 13, color: MUTED },
  allowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },

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
  link: { fontFamily: F.bold, fontSize: 13, color: ACCENT },
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

// "Ben" sekmesi: bir profil sayfası değil, kişinin kendi ayarları. Kimse başkasının "Ben" sayfasını göremez.
// 1.2: Görünen ad, meslek ve üniversite sadece telefonda tutulur; sunucuya hiçbir şey gitmez.
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
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

import { COUNTRY_TR, countryLabel, countryOptions, GENDER_VALUES, genderLabel, Lang } from '@/lib/i18n';
import {
  checkDisplayName,
  cleanDisplayName,
  FRIENDS_TAB_ENABLED,
  Me,
  NAME_MAX,
  nameError,
  nameInitial,
  nameLength,
  OCCUPATIONS,
  occupationLabel,
  STUDENT,
} from '@/lib/me';
import { searchUniversities, UNIVERSITY_OTHER } from '@/lib/universities';

// ---- Renkler (tuvaldeki taslakla aynı) ----
const BG = '#F4F5F7';
const INK = '#16161A';
const SOFT = '#4A4E5A';
const MUTED = '#6B6F7B';
const CHEVRON = '#9A9EA8';
const LINE = '#EEEFF2';
const ACCENT = '#3F3BC9';
const ACCENT_BG = '#E6ECFF';
const NAVY = '#17284D';
const DANGER = '#C0362C';
const F = { regular: 'DMSans_400Regular', medium: 'DMSans_500Medium', bold: 'DMSans_700Bold' };

type ProfileLike = { country?: string; age?: string; city?: string; gender?: string };
type PickOption = { value: string; label: string };
type PickerId = 'occupation' | 'university' | 'country' | 'city' | 'age' | 'gender';

const T = {
  tr: {
    title: 'Ben',
    privacyTitle: 'Gizliliğin',
    privacyNote:
      'Görünen adın ve mesleğin sadece telefonunda tutulur. Yaş, şehir, ülke ve cinsiyet ise yalnızca onay verirsen, oranları hesaplamak için anonim olarak kullanılır.',
    nameHint: 'Görünen adın. Sadece arkadaşların görür.',
    namePlaceholder: 'Görünen ad seç',
    nameEmptyHint: 'Arkadaşlarına görünecek adı sen seçersin.',
    editName: 'Görünen adı düzenle',
    nameTitle: 'Görünen adın',
    nameSub: 'Gerçek adın olması gerekmez. Harf, rakam, boşluk ve emoji kullanabilirsin.',
    nameInput: 'Örn. Ayşe ya da Kahve 🐱',
    save: 'Kaydet',
    cancel: 'Vazgeç',
    occupation: 'Meslek',
    university: 'Üniversite',
    country: 'Ülke',
    city: 'Şehir',
    age: 'Yaş aralığı',
    gender: 'Cinsiyet',
    choose: 'Seç',
    pickOccupation: 'Mesleğini seç',
    occupationNote: 'Sadece telefonunda kalır, sunucuya gönderilmez.',
    pickUniversity: 'Üniversiteni seç',
    searchUniversity: 'Üniversite ara (ör. ODTÜ, Boğaziçi)',
    universityNote: 'Şimdilik sadece telefonunda kalır.',
    universityOther: 'Listede yok',
    noResult: 'Sonuç yok. Listede yoksa en alttaki "Listede yok" seçeneğini kullanabilirsin.',
    pickCountry: 'Hangi ülkede yaşıyorsun?',
    searchCountry: 'Ülke ara',
    pickCity: 'Hangi ilde yaşıyorsun?',
    searchCity: 'İl ara',
    pickAge: 'Yaş aralığını seç',
    pickGender: 'Cinsiyetini seç',
    clear: 'Seçimi kaldır',
    moodShare: 'Ruh hallerimi arkadaşlarım görsün',
    moodShareSub: 'Kapalıyken sadece aktivitelerin görünür',
    streak: (n: number) => (n === 1 ? 'Seri başladı' : `${n} günlük seri`),
    noStreak: 'Henüz serin yok',
    streakDone: 'Bugünkü anını seçtin, yarın da gel',
    streakPending: 'Bugün bir an seç, serin devam etsin',
    streakStart: 'Bir an seç, serin başlasın',
    settings: 'Ayarlar',
    language: 'Dil',
    privacy: 'Gizlilik politikası',
    reset: 'Kayıtlı bilgilerimi sıfırla',
  },
  en: {
    title: 'Me',
    privacyTitle: 'Your privacy',
    privacyNote:
      'Your display name and occupation stay on your phone only. Age, city, country and gender are used anonymously to calculate the percentages, and only if you agree.',
    nameHint: 'Your display name. Only your friends see it.',
    namePlaceholder: 'Choose a display name',
    nameEmptyHint: 'You choose the name your friends will see.',
    editName: 'Edit display name',
    nameTitle: 'Your display name',
    nameSub: "It doesn't have to be your real name. Letters, numbers, spaces and emoji are fine.",
    nameInput: 'e.g. Alex or Coffee 🐱',
    save: 'Save',
    cancel: 'Cancel',
    occupation: 'Occupation',
    university: 'University',
    country: 'Country',
    city: 'City',
    age: 'Age range',
    gender: 'Gender',
    choose: 'Choose',
    pickOccupation: 'Choose your occupation',
    occupationNote: 'Stays on your phone only, never sent to our server.',
    pickUniversity: 'Choose your university',
    searchUniversity: 'Search university (e.g. METU, Boğaziçi)',
    universityNote: 'Stays on your phone only for now.',
    universityOther: 'Not on the list',
    noResult: 'No results. If yours is missing, use "Not on the list" at the bottom.',
    pickCountry: 'Which country do you live in?',
    searchCountry: 'Search country',
    pickCity: 'Which city do you live in?',
    searchCity: 'Search city',
    pickAge: 'Choose your age range',
    pickGender: 'Choose your gender',
    clear: 'Clear selection',
    moodShare: 'Let my friends see my moods',
    moodShareSub: 'When off, only your activities are visible',
    streak: (n: number) => (n === 1 ? 'Streak started' : `${n}-day streak`),
    noStreak: 'No streak yet',
    streakDone: "You've picked today's moment, come back tomorrow",
    streakPending: 'Pick a moment today to keep your streak',
    streakStart: 'Pick a moment to start your streak',
    settings: 'Settings',
    language: 'Language',
    privacy: 'Privacy policy',
    reset: 'Reset my saved info',
  },
};

function tap(select = false) {
  const p = select ? Haptics.selectionAsync() : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  p.catch(() => {});
}

export function MeTab({
  lang,
  me,
  onMeChange,
  profile,
  onProfileChange,
  cities,
  ageRanges,
  streak,
  canReset,
  onReset,
  onLangChange,
  privacyUrl,
  topInset,
  bottomSpace,
}: {
  lang: Lang;
  me: Me;
  onMeChange: (next: Me) => void;
  profile: ProfileLike;
  onProfileChange: (next: ProfileLike) => void;
  cities: string[];
  ageRanges: string[];
  streak: { count: number; doneToday: boolean };
  canReset: boolean;
  onReset: () => void;
  onLangChange: (l: Lang) => void;
  privacyUrl: string;
  topInset: number;
  bottomSpace: number;
}) {
  const t = T[lang];
  const [picker, setPicker] = useState<PickerId | null>(null);
  const [nameOpen, setNameOpen] = useState(false);

  const isStudent = me.occupation === STUDENT;
  const showCity = profile.country === COUNTRY_TR;
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';

  function universityLabel(v: string | undefined) {
    if (!v) return '';
    return v === UNIVERSITY_OTHER ? t.universityOther : v;
  }

  function pickOccupation(v: string | null) {
    const next: Me = { ...me, occupation: v ?? undefined };
    // Öğrenci değilse üniversite bilgisi tutulmaz
    if (v !== STUDENT) delete next.university;
    onMeChange(next);
    setPicker(null);
    // "Öğrenci" seçilince üniversite seçimi hemen açılsın
    if (v === STUDENT && !me.university) setTimeout(() => setPicker('university'), 350);
  }

  // ---- Seçici içerikleri ----
  let sheet: {
    title: string;
    note?: string;
    placeholder?: string;
    selected?: string;
    getOptions: (q: string) => PickOption[];
    onPick: (v: string) => void;
    onClear?: () => void;
    emptyText?: string;
  } | null = null;

  const filterBy = (opts: PickOption[]) => (q: string) => {
    const query = q.trim().toLocaleLowerCase(locale);
    return query ? opts.filter((o) => o.label.toLocaleLowerCase(locale).includes(query)) : opts;
  };

  if (picker === 'occupation') {
    sheet = {
      title: t.pickOccupation,
      note: t.occupationNote,
      selected: me.occupation,
      getOptions: () => OCCUPATIONS.map((o) => ({ value: o.id, label: o[lang] })),
      onPick: (v) => pickOccupation(v),
      onClear: me.occupation ? () => pickOccupation(null) : undefined,
    };
  } else if (picker === 'university') {
    sheet = {
      title: t.pickUniversity,
      note: t.universityNote,
      placeholder: t.searchUniversity,
      selected: me.university,
      getOptions: (q) => [
        ...searchUniversities(q).map((u) => ({ value: u, label: u })),
        { value: UNIVERSITY_OTHER, label: t.universityOther },
      ],
      onPick: (v) => {
        onMeChange({ ...me, university: v });
        setPicker(null);
      },
      onClear: me.university
        ? () => {
            const next = { ...me };
            delete next.university;
            onMeChange(next);
            setPicker(null);
          }
        : undefined,
    };
  } else if (picker === 'country') {
    sheet = {
      title: t.pickCountry,
      placeholder: t.searchCountry,
      selected: profile.country,
      getOptions: filterBy(countryOptions(lang)),
      onPick: (v) => {
        onProfileChange({ ...profile, country: v });
        setPicker(null);
      },
    };
  } else if (picker === 'city') {
    sheet = {
      title: t.pickCity,
      placeholder: t.searchCity,
      selected: profile.city,
      getOptions: filterBy(cities.map((c) => ({ value: c, label: c }))),
      onPick: (v) => {
        onProfileChange({ ...profile, city: v });
        setPicker(null);
      },
      onClear: profile.city
        ? () => {
            const next = { ...profile };
            delete next.city;
            onProfileChange(next);
            setPicker(null);
          }
        : undefined,
    };
  } else if (picker === 'age') {
    sheet = {
      title: t.pickAge,
      selected: profile.age,
      getOptions: () => ageRanges.map((a) => ({ value: a, label: a })),
      onPick: (v) => {
        onProfileChange({ ...profile, age: v });
        setPicker(null);
      },
      onClear: profile.age
        ? () => {
            const next = { ...profile };
            delete next.age;
            onProfileChange(next);
            setPicker(null);
          }
        : undefined,
    };
  } else if (picker === 'gender') {
    sheet = {
      title: t.pickGender,
      selected: profile.gender,
      getOptions: () => GENDER_VALUES.map((g) => ({ value: g, label: genderLabel(g, lang) })),
      onPick: (v) => {
        onProfileChange({ ...profile, gender: v });
        setPicker(null);
      },
      onClear: profile.gender
        ? () => {
            const next = { ...profile };
            delete next.gender;
            onProfileChange(next);
            setPicker(null);
          }
        : undefined,
    };
  }

  const openPicker = (p: PickerId) => {
    tap(true);
    setPicker(p);
  };

  const rows: { id: PickerId; icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[] = [
    { id: 'occupation', icon: 'briefcase-outline', label: t.occupation, value: occupationLabel(me.occupation, lang) },
    ...(isStudent
      ? [{ id: 'university' as const, icon: 'school-outline' as const, label: t.university, value: universityLabel(me.university) }]
      : []),
    { id: 'country', icon: 'earth-outline', label: t.country, value: countryLabel(profile.country, lang) },
    ...(showCity ? [{ id: 'city' as const, icon: 'location-outline' as const, label: t.city, value: profile.city ?? '' }] : []),
    { id: 'age', icon: 'person-outline', label: t.age, value: profile.age ?? '' },
    { id: 'gender', icon: 'male-female-outline', label: t.gender, value: genderLabel(profile.gender, lang) },
  ];

  const name = me.displayName ? cleanDisplayName(me.displayName) : '';

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topInset + 16, paddingBottom: bottomSpace }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t.title}</Text>
        <View style={styles.privacyCard} accessibilityRole="text">
          <View style={styles.privacyIcon}>
            <Ionicons name="shield-checkmark" size={20} color={ACCENT} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.privacyTitle}>{t.privacyTitle}</Text>
            <Text style={styles.privacyText}>{t.privacyNote}</Text>
          </View>
        </View>

        {/* Görünen ad */}
        <Pressable
          style={styles.idCard}
          onPress={() => {
            tap();
            setNameOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={t.editName}
        >
          <View style={styles.avatar}>
            {name ? (
              <Text style={styles.avatarText}>{nameInitial(name)}</Text>
            ) : (
              <Ionicons name="person" size={24} color={ACCENT} />
            )}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.name, !name && styles.namePlaceholder]} numberOfLines={1}>
              {name || t.namePlaceholder}
            </Text>
            <Text style={styles.nameHint}>{name ? t.nameHint : t.nameEmptyHint}</Text>
          </View>
          <View style={styles.editBtn}>
            <Ionicons name="pencil" size={17} color={INK} />
          </View>
        </Pressable>

        {/* Meslek, üniversite ve karşılaştırma bilgileri */}
        <View style={styles.listCard}>
          {rows.map((r, i) => (
            <Pressable
              key={r.id}
              style={[styles.row, i < rows.length - 1 && styles.rowLine]}
              onPress={() => openPicker(r.id)}
              accessibilityRole="button"
              accessibilityLabel={`${r.label}${r.value ? ', ' + r.value : ''}`}
            >
              <Ionicons name={r.icon} size={20} color={SOFT} />
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text style={[styles.rowValue, !r.value && styles.rowChoose]} numberOfLines={1}>
                {r.value || t.choose}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={CHEVRON} />
            </Pressable>
          ))}
        </View>

        {/* Ruh hali paylaşımı (arkadaşlar özelliği açıkken) */}
        {FRIENDS_TAB_ENABLED ? (
          <View style={styles.toggleCard}>
            <Ionicons name="lock-closed-outline" size={20} color={SOFT} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.rowLabel}>{t.moodShare}</Text>
              <Text style={styles.toggleSub}>{t.moodShareSub}</Text>
            </View>
            <Switch
              value={!!me.moodShare}
              onValueChange={(v) => {
                tap(true);
                onMeChange({ ...me, moodShare: v });
              }}
              trackColor={{ true: ACCENT, false: '#D5D7DE' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#D5D7DE"
            />
          </View>
        ) : null}

        {/* Seri */}
        <View style={styles.streakCard}>
          <Ionicons name="flame" size={24} color={streak.count >= 1 ? '#FDBA74' : 'rgba(255,255,255,0.45)'} />
          <View style={{ flex: 1 }}>
            <Text style={styles.streakTitle}>{streak.count >= 1 ? t.streak(streak.count) : t.noStreak}</Text>
            <Text style={styles.streakSub}>
              {streak.count === 0 ? t.streakStart : streak.doneToday ? t.streakDone : t.streakPending}
            </Text>
          </View>
        </View>

        {/* Ayarlar */}
        <Text style={styles.sectionTitle}>{t.settings}</Text>
        <View style={styles.listCard}>
          <View style={[styles.row, styles.rowLine]}>
            <Ionicons name="language-outline" size={20} color={SOFT} />
            <Text style={styles.rowLabel}>{t.language}</Text>
            <View style={styles.langSwitch}>
              {(['tr', 'en'] as Lang[]).map((l) => (
                <Pressable
                  key={l}
                  onPress={() => onLangChange(l)}
                  style={[styles.langPill, lang === l && styles.langPillOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: lang === l }}
                  hitSlop={4}
                >
                  <Text style={[styles.langText, lang === l && styles.langTextOn]}>
                    {l === 'tr' ? 'Türkçe' : 'English'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Pressable
            style={[styles.row, canReset && styles.rowLine]}
            onPress={() => Linking.openURL(privacyUrl).catch(() => {})}
            accessibilityRole="link"
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={SOFT} />
            <Text style={styles.rowLabel}>{t.privacy}</Text>
            <Ionicons name="open-outline" size={16} color={CHEVRON} />
          </Pressable>
          {canReset ? (
            <Pressable style={styles.row} onPress={onReset} accessibilityRole="button">
              <Ionicons name="trash-outline" size={20} color={DANGER} />
              <Text style={[styles.rowLabel, { color: DANGER }]}>{t.reset}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {/* Kaydırınca içerik saatin ve pilin altına girmesin */}
      <View style={[styles.statusShade, { height: topInset }]} pointerEvents="none" />

      <PickerSheet
        visible={!!sheet}
        title={sheet?.title ?? ''}
        note={sheet?.note}
        placeholder={sheet?.placeholder}
        selected={sheet?.selected}
        getOptions={sheet?.getOptions ?? (() => [])}
        onPick={(v) => {
          tap(true);
          sheet?.onPick(v);
        }}
        onClear={
          sheet?.onClear
            ? () => {
                tap(true);
                sheet?.onClear?.();
              }
            : undefined
        }
        clearLabel={t.clear}
        emptyText={picker === 'university' ? t.noResult : undefined}
        onClose={() => setPicker(null)}
        key={picker ?? 'none'}
      />

      <NameEditor
        visible={nameOpen}
        lang={lang}
        initial={name}
        onCancel={() => setNameOpen(false)}
        onSave={(v) => {
          tap();
          onMeChange({ ...me, displayName: v });
          setNameOpen(false);
        }}
      />
    </View>
  );
}

// ---- Alttan açılan seçim paneli ----
function PickerSheet({
  visible,
  title,
  note,
  placeholder,
  selected,
  getOptions,
  onPick,
  onClear,
  clearLabel,
  emptyText,
  onClose,
}: {
  visible: boolean;
  title: string;
  note?: string;
  placeholder?: string;
  selected?: string;
  getOptions: (q: string) => PickOption[];
  onPick: (v: string) => void;
  onClear?: () => void;
  clearLabel: string;
  emptyText?: string;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const options = getOptions(q);
  const searchable = !!placeholder;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.sheetWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Kapat" />
        <View style={[styles.sheet, searchable ? { height: '78%' } : { maxHeight: '78%' }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn} accessibilityRole="button">
              <Ionicons name="close" size={20} color={INK} />
            </Pressable>
          </View>
          {note ? <Text style={styles.sheetNote}>{note}</Text> : null}
          {searchable ? (
            <View style={styles.searchBox}>
              <Ionicons name="search" size={17} color={MUTED} />
              <TextInput
                style={styles.searchInput}
                placeholder={placeholder}
                placeholderTextColor="#9A9EA8"
                value={q}
                onChangeText={setQ}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
            </View>
          ) : null}
          <FlatList
            data={options}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            renderItem={({ item }) => {
              const on = item.value === selected;
              return (
                <Pressable style={styles.option} onPress={() => onPick(item.value)} accessibilityState={{ selected: on }}>
                  <Text style={[styles.optionText, on && styles.optionTextOn]}>{item.label}</Text>
                  {on ? <Ionicons name="checkmark" size={20} color={ACCENT} /> : null}
                </Pressable>
              );
            }}
            ListEmptyComponent={emptyText ? <Text style={styles.emptyText}>{emptyText}</Text> : null}
            ListFooterComponent={
              onClear ? (
                <Pressable style={styles.option} onPress={onClear}>
                  <Text style={[styles.optionText, { color: DANGER }]}>{clearLabel}</Text>
                </Pressable>
              ) : null
            }
            contentContainerStyle={{ paddingBottom: 28 }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---- Görünen ad düzenleme ----
function NameEditor({
  visible,
  lang,
  initial,
  onCancel,
  onSave,
}: {
  visible: boolean;
  lang: Lang;
  initial: string;
  onCancel: () => void;
  onSave: (v: string) => void;
}) {
  const t = T[lang];
  const [value, setValue] = useState(initial);
  const [error, setError] = useState('');

  const len = nameLength(cleanDisplayName(value));

  function save() {
    const c = checkDisplayName(value);
    if (c !== 'ok') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setError(nameError(c, lang));
      return;
    }
    onSave(cleanDisplayName(value));
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
      onShow={() => {
        setValue(initial);
        setError('');
      }}
    >
      <KeyboardAvoidingView style={styles.dialogWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={styles.dialog}>
          <Text style={styles.sheetTitle}>{t.nameTitle}</Text>
          <Text style={styles.dialogSub}>{t.nameSub}</Text>
          <View style={[styles.nameInputBox, !!error && styles.nameInputError]}>
            <TextInput
              style={styles.nameInput}
              value={value}
              onChangeText={(v) => {
                setValue(v);
                if (error) setError('');
              }}
              placeholder={t.nameInput}
              placeholderTextColor="#9A9EA8"
              autoFocus
              autoCorrect={false}
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={save}
            />
            <Text style={[styles.counter, len > NAME_MAX && { color: DANGER }]}>
              {len}/{NAME_MAX}
            </Text>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.dialogButtons}>
            <Pressable style={styles.ghostBtn} onPress={onCancel}>
              <Text style={styles.ghostText}>{t.cancel}</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={save}>
              <Text style={styles.primaryText}>{t.save}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 20, gap: 16 },
  title: { fontFamily: F.bold, fontSize: 28, color: INK, letterSpacing: -0.3 },
  statusShade: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: BG },
  privacyCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#EEF0FF',
    borderWidth: 1,
    borderColor: '#D9DDFB',
    borderRadius: 18,
    padding: 14,
    marginTop: -4,
  },
  privacyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyTitle: { fontFamily: F.bold, fontSize: 14, color: '#262A8A' },
  privacyText: { fontFamily: F.regular, fontSize: 13, lineHeight: 18, color: '#3D4160' },

  idCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: F.bold, fontSize: 23, color: ACCENT },
  name: { fontFamily: F.bold, fontSize: 18, color: INK },
  namePlaceholder: { color: ACCENT },
  nameHint: { fontFamily: F.regular, fontSize: 13, lineHeight: 17, color: SOFT },
  editBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F1F4',
    alignItems: 'center',
    justifyContent: 'center',
  },

  listCard: { backgroundColor: '#FFFFFF', borderRadius: 22, paddingHorizontal: 18, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, minHeight: 52 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: LINE },
  rowLabel: { flex: 1, fontFamily: F.regular, fontSize: 15, color: INK },
  rowValue: { maxWidth: '55%', fontFamily: F.regular, fontSize: 14, color: SOFT, textAlign: 'right' },
  rowChoose: { color: ACCENT, fontFamily: F.medium },

  toggleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleSub: { fontFamily: F.regular, fontSize: 12, color: MUTED },

  streakCard: {
    backgroundColor: NAVY,
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  streakTitle: { fontFamily: F.bold, fontSize: 16, color: '#FFFFFF' },
  streakSub: { fontFamily: F.regular, fontSize: 12, color: '#C9D3EE', marginTop: 1 },

  sectionTitle: { fontFamily: F.bold, fontSize: 15, color: MUTED, marginTop: 4, marginBottom: -6, marginLeft: 4 },
  langSwitch: { flexDirection: 'row', backgroundColor: '#F0F1F4', borderRadius: 999, padding: 3 },
  langPill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  langPillOn: { backgroundColor: '#FFFFFF' },
  langText: { fontFamily: F.medium, fontSize: 13, color: MUTED },
  langTextOn: { fontFamily: F.bold, color: INK },

  // Seçim paneli
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,14,28,0.45)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: '#D9DBE1', marginBottom: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sheetTitle: { flex: 1, fontFamily: F.bold, fontSize: 19, color: INK },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F0F1F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetNote: { fontFamily: F.regular, fontSize: 13, color: MUTED, marginTop: 4 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F4F5F7',
    borderRadius: 14,
    paddingHorizontal: 12,
    marginTop: 14,
    marginBottom: 4,
  },
  searchInput: { flex: 1, fontFamily: F.regular, fontSize: 15, color: INK, paddingVertical: 11 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    gap: 12,
  },
  optionText: { flex: 1, fontFamily: F.regular, fontSize: 15, color: INK },
  optionTextOn: { fontFamily: F.bold, color: ACCENT },
  emptyText: { fontFamily: F.regular, fontSize: 14, color: MUTED, paddingVertical: 18, lineHeight: 20 },

  // Ad düzenleme penceresi
  dialogWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 22 },
  dialog: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, gap: 10 },
  dialogSub: { fontFamily: F.regular, fontSize: 13, lineHeight: 18, color: SOFT },
  nameInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E1E3E9',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginTop: 6,
  },
  nameInputError: { borderColor: DANGER },
  nameInput: { flex: 1, fontFamily: F.medium, fontSize: 17, color: INK, paddingVertical: 12 },
  counter: { fontFamily: F.medium, fontSize: 12, color: MUTED },
  error: { fontFamily: F.medium, fontSize: 13, color: DANGER },
  dialogButtons: { flexDirection: 'row', gap: 10, marginTop: 8 },
  ghostBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F0F1F4',
    alignItems: 'center',
  },
  ghostText: { fontFamily: F.bold, fontSize: 15, color: INK },
  primaryBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: ACCENT, alignItems: 'center' },
  primaryText: { fontFamily: F.bold, fontSize: 15, color: '#FFFFFF' },
});

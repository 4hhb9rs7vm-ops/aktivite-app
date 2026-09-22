import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVITIES = [
  { id: 'lying', name: 'Uzanıyorum', icon: '🛌', world: 22, country: 30 },
  { id: 'work', name: 'İşteyim', icon: '💼', world: 18, country: 14 },
  { id: 'eat', name: 'Yemek yiyorum', icon: '🍽️', world: 7.5, country: 9 },
  { id: 'travel', name: 'Yoldayım', icon: '🚗', world: 8, country: 10 },
  { id: 'study', name: 'Ders çalışıyorum', icon: '📚', world: 6, country: 7 },
  { id: 'sport', name: 'Spor yapıyorum', icon: '🏋️', world: 4, country: 3 },
  { id: 'tv', name: 'Dizi izliyorum', icon: '📺', world: 7, country: 8 },
  { id: 'coffee', name: 'Kahve içiyorum', icon: '☕', world: 5, country: 6 },
  { id: 'gaming', name: 'Oyun oynuyorum', icon: '🎮', world: 9, country: 6 },
  { id: 'shop', name: 'Alışveriş yapıyorum', icon: '🛒', world: 3.5, country: 3 },
  { id: 'chores', name: 'Ev işi yapıyorum', icon: '🧹', world: 5, country: 2 },
  { id: 'friends', name: 'Arkadaşlarlayım', icon: '👥', world: 4.5, country: 2 },
];

const FILTERS = [
  { id: 'world', label: 'Dünya' },
  { id: 'country', label: 'Ülkem' },
  { id: 'age', label: 'Yaşıtlarım' },
  { id: 'city', label: 'Şehrim' },
  { id: 'gender', label: 'Cinsiyetim' },
] as const;

const COUNTRIES = [
  'Türkiye', 'Almanya', 'Amerika Birleşik Devletleri', 'Azerbaycan', 'Birleşik Krallık',
  'Fransa', 'Hollanda', 'İtalya', 'İspanya', 'Kanada', 'Kuzey Kıbrıs', 'Diğer',
];
const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55+'];
const GENDERS = ['Kadın', 'Erkek', 'Belirtmek istemiyorum'];
const NO_ANSWER = 'Belirtmek istemiyorum';

const CITIES = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya',
  'Ardahan', 'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik',
  'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum',
  'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir',
  'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkâri', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul',
  'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kilis',
  'Kırıkkale', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa',
  'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye', 'Rize',
  'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Şanlıurfa', 'Şırnak', 'Tekirdağ',
  'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak',
];

type Activity = (typeof ACTIVITIES)[number];
type FilterId = (typeof FILTERS)[number]['id'];
type Profile = { country?: string; age?: string; city?: string; gender?: string };

function formatPct(p: number) {
  return '%' + p.toFixed(1).replace('.', ',');
}

function demoPct(base: number, seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const factor = 0.5 + ((h % 1000) / 1000) * 1.1;
  return Math.round(base * factor * 10) / 10;
}

function lineFor(filter: FilterId, value?: string) {
  switch (filter) {
    case 'world':
      return 'Şu an dünyada seninle aynı şeyi yapanların oranı';
    case 'country':
      return `Şu an ülkende (${value}) seninle aynı şeyi yapanların oranı`;
    case 'age':
      return `Şu an ${value} yaş aralığında seninle aynı şeyi yapanların oranı`;
    case 'city':
      return `Şu an ${value} ilinde seninle aynı şeyi yapanların oranı`;
    case 'gender':
      return `Şu an ${value?.toLocaleLowerCase('tr-TR')} kullanıcılar arasında seninle aynı şeyi yapanların oranı`;
  }
}

function OptionPicker({
  title,
  options,
  onPick,
}: {
  title: string;
  options: string[];
  onPick: (v: string) => void;
}) {
  return (
    <View style={[styles.picker, { flex: 1 }]}>
      <Text style={styles.pickerTitle}>{title}</Text>
      <ScrollView>
        {options.map((o) => (
          <Pressable key={o} style={styles.row} onPress={() => onPick(o)}>
            <Text style={styles.rowText}>{o}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function CityPicker({ onPick }: { onPick: (c: string) => void }) {
  const [q, setQ] = useState('');
  const query = q.toLocaleLowerCase('tr-TR');
  const list = CITIES.filter((c) => c.toLocaleLowerCase('tr-TR').includes(query));
  return (
    <View style={[styles.picker, { flex: 1 }]}>
      <Text style={styles.pickerTitle}>Hangi ilde yaşıyorsun?</Text>
      <TextInput style={styles.input} placeholder="İl ara" value={q} onChangeText={setQ} />
      <ScrollView keyboardShouldPersistTaps="handled">
        {list.map((c) => (
          <Pressable key={c} style={styles.row} onPress={() => onPick(c)}>
            <Text style={styles.rowText}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default function HomeScreen() {
  const [selected, setSelected] = useState<Activity | null>(null);
  const [filter, setFilter] = useState<FilterId>('world');
  const [profile, setProfile] = useState<Profile>({});
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('profile').then((v) => {
      if (v) setProfile(JSON.parse(v));
    });
  }, []);

  function saveProfile(next: Profile) {
    setProfile(next);
    AsyncStorage.setItem('profile', JSON.stringify(next));
    setEditing(false);
  }

  function chooseFilter(id: FilterId) {
    setFilter(id);
    setEditing(false);
  }

  function resetProfile() {
    Alert.alert(
      'Bilgilerin silinsin mi?',
      'Ülke, yaş, şehir ve cinsiyet seçimlerin bu telefondan silinir.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            AsyncStorage.removeItem('profile');
            setProfile({});
            setEditing(false);
          },
        },
      ]
    );
  }

  if (selected) {
    const needsProfile = filter !== 'world';
    const value = needsProfile ? profile[filter as keyof Profile] : undefined;
    const picking = needsProfile && (!value || editing);
    const declined = filter === 'gender' && value === NO_ANSWER && !editing;

    let pct = selected.world;
    if (needsProfile && value) {
      pct =
        filter === 'country' && value === 'Türkiye'
          ? selected.country
          : demoPct(selected.world, selected.id + filter + value);
    }

    let body;
    if (picking && filter === 'country') {
      body = (
        <OptionPicker
          title="Hangi ülkede yaşıyorsun?"
          options={COUNTRIES}
          onPick={(v) => saveProfile({ ...profile, country: v })}
        />
      );
    } else if (picking && filter === 'age') {
      body = (
        <OptionPicker
          title="Yaş aralığını seç"
          options={AGE_RANGES}
          onPick={(v) => saveProfile({ ...profile, age: v })}
        />
      );
    } else if (picking && filter === 'city') {
      body = <CityPicker onPick={(v) => saveProfile({ ...profile, city: v })} />;
    } else if (picking && filter === 'gender') {
      body = (
        <OptionPicker
          title="Cinsiyetini seç"
          options={GENDERS}
          onPick={(v) => saveProfile({ ...profile, gender: v })}
        />
      );
    } else if (declined) {
      body = (
        <View style={styles.center}>
          <Text style={styles.line}>
            Cinsiyetini belirtmediğin için bu filtre kapalı.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={() => setEditing(true)}>
            <Text style={styles.primaryBtnText}>Cinsiyetimi seç</Text>
          </Pressable>
        </View>
      );
    } else {
      body = (
        <View style={styles.center}>
          <Text style={styles.bigPct}>{formatPct(pct)}</Text>
          <Text style={styles.line}>{lineFor(filter, value)}</Text>
          <Text style={styles.note}>Oran, uygulamayı kullananlar arasındadır.</Text>
        </View>
      );
    }

    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.resultContainer}>
          <View style={styles.topRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>
                {selected.icon} {selected.name}
              </Text>
            </View>
          </View>

          <View style={styles.filterRow}>
            {FILTERS.map((f) => (
              <Pressable
                key={f.id}
                style={[styles.filterBtn, filter === f.id && styles.filterBtnActive]}
                onPress={() => chooseFilter(f.id)}
              >
                <Text style={[styles.filterText, filter === f.id && styles.filterTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {needsProfile && value && !editing && !declined ? (
            <Pressable onPress={() => setEditing(true)}>
              <Text style={styles.editLink}>{value} · Değiştir</Text>
            </Pressable>
          ) : null}

          {body}

          <View style={styles.timerBox}>
            <View style={styles.timerLabels}>
              <Text style={styles.timerText}>45 dk sonra otomatik biter</Text>
              <Text style={styles.timerText}>60 dk</Text>
            </View>
            <View style={styles.timerTrack}>
              <View style={styles.timerFill} />
            </View>
          </View>

          <Pressable
            style={styles.button}
            onPress={() => {
              setSelected(null);
              setEditing(false);
            }}
          >
            <Text style={styles.buttonText}>← Değiştir</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Şu an ne yapıyorsun?</Text>
        <Text style={styles.subtitle}>Birine dokun, dünyayla karşılaştır.</Text>

        <View style={styles.grid}>
          {ACTIVITIES.map((a) => (
            <Pressable key={a.id} style={styles.card} onPress={() => setSelected(a)}>
              <Text style={styles.icon}>{a.icon}</Text>
              <Text style={styles.name}>{a.name}</Text>
            </Pressable>
          ))}
        </View>

        {Object.values(profile).some(Boolean) ? (
          <Pressable onPress={resetProfile}>
            <Text style={styles.resetLink}>Kayıtlı bilgilerimi sıfırla</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  container: { padding: 16, paddingBottom: 24 },
  title: { fontSize: 26, fontWeight: '600', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    flexBasis: '48%',
    height: 96,
    borderRadius: 14,
    padding: 12,
    justifyContent: 'space-between',
    backgroundColor: '#f3f4f6',
  },
  icon: { fontSize: 26 },
  name: { fontSize: 15, fontWeight: '500' },
  resetLink: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginTop: 24,
    textDecorationLine: 'underline',
  },

  resultContainer: { flex: 1, padding: 16, paddingBottom: 16 },
  topRow: { flexDirection: 'row' },
  chip: {
    backgroundColor: '#e8f0fe',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipText: { color: '#2f6fed', fontSize: 14, fontWeight: '500' },

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  filterBtnActive: { backgroundColor: '#2f6fed' },
  filterText: { fontSize: 14, color: '#555' },
  filterTextActive: { color: '#ffffff', fontWeight: '600' },
  editLink: {
    fontSize: 14,
    color: '#2f6fed',
    marginTop: 12,
    textDecorationLine: 'underline',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bigPct: { fontSize: 80, fontWeight: '600', letterSpacing: -2 },
  line: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 24,
  },
  note: { fontSize: 12, color: '#999', marginTop: 10, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: '#2f6fed',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  primaryBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },

  picker: { paddingTop: 16, paddingBottom: 8 },
  pickerTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    marginBottom: 8,
  },
  rowText: { fontSize: 16 },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 10,
  },

  timerBox: { marginBottom: 14, marginTop: 8 },
  timerLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  timerText: { fontSize: 12, color: '#666' },
  timerTrack: { height: 6, backgroundColor: '#f3f4f6', borderRadius: 3 },
  timerFill: { height: 6, width: '25%', backgroundColor: '#2f6fed', borderRadius: 3 },

  button: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '500' },
});
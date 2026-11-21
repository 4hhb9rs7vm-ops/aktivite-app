// 1.6.0: An ekranında isteğe bağlı kartlar, oran kartının hemen altında alt alta:
// tepki kutusu ve alt soru / yaş / özet kartı. Sıra sunucudan (cat_settings.slot_reaction_first, varsayılan önce tepki).
// (İlk denemelerde kartlar arasında geçiş vardı: önce kaydırma, sonra düğme. İkisi de takıldı ve gözden kaçtı;
// iki kart da görünür kalsın diye alt alta dizildi. Alan kaydırılabilir olduğu için küçük ekranda da sığar.)
import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { Lang } from '@/lib/i18n';
import { getCatalog } from '@/lib/catalog';
import { ReactionBox } from '@/components/ReactionCards';

type Props = {
  activityId: string;
  mood: boolean;
  lang: Lang;
  // Alt soru / yaş / özet kartı. onDone artık bir şey yapmaz (eski geçiş için vardı).
  renderExtra: (onDone: () => void) => ReactNode;
};

export function OptionalSlot({ activityId, mood, lang, renderExtra }: Props) {
  const reactionFirst = getCatalog()?.settings.reactionFirst ?? true;
  const react = <ReactionBox key="r" activityId={activityId} mood={mood} lang={lang} />;
  const extra = <View key="e">{renderExtra(() => {})}</View>;
  return <View>{reactionFirst ? [react, extra] : [extra, react]}</View>;
}

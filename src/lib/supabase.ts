import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://ibnvwdcrxpxcquzvveue.supabase.co',
  'sb_publishable_5yJrrpfjymf4ZzFv9BXx5Q_05uwKbkR',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
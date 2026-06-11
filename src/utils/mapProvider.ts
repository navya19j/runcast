import { Platform } from 'react-native';
import { PROVIDER_GOOGLE, type Provider } from 'react-native-maps';

/** Google Maps on Android; Apple Maps on iOS (no Google SDK / API key required). */
export const MAP_PROVIDER: Provider | undefined =
  Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;

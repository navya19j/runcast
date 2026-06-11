// app.config.js reads secrets from .env — never commit .env to git
require('dotenv').config();

// react-native-maps v1.x renamed its pod from 'react-native-google-maps' → 'react-native-maps'.
// The expo prebuild plugin still emits the old name, so we patch it post-prebuild.
const { withPodfile } = require('@expo/config-plugins');

function withFixMapsPodfile(config) {
  return withPodfile(config, (cfg) => {
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /pod 'react-native-google-maps'/g,
      "pod 'react-native-maps'",
    );
    return cfg;
  });
}

module.exports = withFixMapsPodfile({
  expo: {
    name: 'RunCast',
    slug: 'runcast',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.navyaj.runcast',
      infoPlist: {
        // Required for iOS background location — must be explicit string values
        NSLocationWhenInUseUsageDescription:
          'RunCast uses your location to play audio commentary as you run past landmarks.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'RunCast needs your location in the background so audio commentary keeps playing when your screen turns off mid-run.',
        NSLocationAlwaysUsageDescription:
          'RunCast needs your location in the background so audio commentary keeps playing when your screen turns off mid-run.',
        // location = GPS in background, audio = AVAudioSession continues in bg
        UIBackgroundModes: ['location', 'audio', 'processing'],
      },
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS,
      },
    },
    android: {
      package: 'com.navyaj.runcast',
      adaptiveIcon: {
        backgroundColor: '#0f0f0f',
        foregroundImage: './assets/adaptive-icon.png',
      },
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',  // Required for background GPS on Android
        'FOREGROUND_SERVICE',          // Required to show the persistent notification
        'FOREGROUND_SERVICE_LOCATION', // Android 14+ — foreground service type
      ],
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
        },
      },
    },
    plugins: [
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'RunCast needs your location to play audio commentary as you run past landmarks, even when the screen is off.',
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
        },
      ],
      'expo-audio',
    ],
    web: {
      favicon: './assets/favicon.png',
    },
    newArchEnabled: false,
    experiments: {
      newArchEnabled: false,
    },
  },
});

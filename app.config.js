// app.config.js reads secrets from .env — never commit .env to git
require('dotenv').config();

module.exports = {
  expo: {
    name: 'RunCast',
    slug: 'runcast',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.runcast.app',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'RunCast uses your location to trigger audio commentary as you run past landmarks.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'RunCast uses your location in the background to trigger audio commentary during your run.',
        UIBackgroundModes: ['location', 'audio'],
      },
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS,
      },
    },
    android: {
      package: 'com.runcast.app',
      adaptiveIcon: {
        backgroundColor: '#0f0f0f',
        foregroundImage: './assets/adaptive-icon.png',
      },
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
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
            'RunCast uses location to play audio commentary as you run past landmarks.',
        },
      ],
    ],
    web: {
      favicon: './assets/favicon.png',
    },
  },
};

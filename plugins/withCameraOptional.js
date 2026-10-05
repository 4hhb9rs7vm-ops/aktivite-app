// Android: Kamera isteğe bağlı.
// Kamera sadece QR ile arkadaş eklemek için kullanılıyor; uygulamanın geri kalanı kamerasız da çalışır.
// Bu ayar olmadan Android, kamera izni yüzünden kamerası olmayan cihazları (çoğunlukla tabletler)
// Play Store'da uygulamayı yükleyemeyen cihazlar arasına alıyor.
const { withAndroidManifest } = require('expo/config-plugins');

const FEATURES = ['android.hardware.camera', 'android.hardware.camera.autofocus', 'android.hardware.camera.any'];

module.exports = function withCameraOptional(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] || 'http://schemas.android.com/tools';
    manifest['uses-feature'] = manifest['uses-feature'] || [];

    for (const name of FEATURES) {
      const existing = manifest['uses-feature'].find((f) => f.$ && f.$['android:name'] === name);
      if (existing) {
        existing.$['android:required'] = 'false';
        existing.$['tools:replace'] = 'android:required';
      } else {
        manifest['uses-feature'].push({
          $: { 'android:name': name, 'android:required': 'false', 'tools:replace': 'android:required' },
        });
      }
    }
    return cfg;
  });
};

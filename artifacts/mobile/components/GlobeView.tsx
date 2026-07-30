import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { GLOBE_HTML } from '@/constants/globeHtml';

interface GlobeViewProps {
  autoRotate?: boolean;
  interactive?: boolean;
  onCountryTap?: (lat: number, lon: number) => void;
  onReady?: () => void;
  selectedLatLon?: { lat: number; lon: number } | null;
}

export function GlobeView({
  autoRotate = false,
  interactive = true,
  onCountryTap,
  onReady,
  selectedLatLon,
}: GlobeViewProps) {
  const webviewRef = useRef<WebView>(null);

  const config = JSON.stringify({ autoRotate, interactive });
  const injectedJS = `window.GLOBE_CONFIG=${config};true;`;

  useEffect(() => {
    if (!webviewRef.current) return;
    if (selectedLatLon) {
      const js = `if(window.setSelectedCountry)window.setSelectedCountry(${selectedLatLon.lat},${selectedLatLon.lon});true;`;
      webviewRef.current.injectJavaScript(js);
    } else {
      webviewRef.current.injectJavaScript(`if(window.clearSelectedCountry)window.clearSelectedCountry();true;`);
    }
  }, [selectedLatLon]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type: string;
        lat?: number;
        lon?: number;
      };
      if (data.type === 'tap' && onCountryTap && data.lat !== undefined && data.lon !== undefined) {
        onCountryTap(data.lat, data.lon);
      } else if (data.type === 'ready' && onReady) {
        onReady();
      }
    } catch {
      // ignore parse errors
    }
  };

  // WebView is not available on web platform — render a placeholder
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webPlaceholder} />
    );
  }

  return (
    <WebView
      ref={webviewRef}
      source={{ html: GLOBE_HTML }}
      style={styles.webview}
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      originWhitelist={['*']}
      onMessage={handleMessage}
      javaScriptEnabled
      domStorageEnabled
      injectedJavaScriptBeforeContentLoaded={injectedJS}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      allowsFullscreenVideo={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      cacheEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: '#050A14',
  },
  webPlaceholder: {
    flex: 1,
    backgroundColor: '#050A14',
  },
});

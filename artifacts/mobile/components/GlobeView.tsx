import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { GLOBE_HTML } from '@/constants/globeHtml';

interface GlobeViewProps {
  autoRotate?: boolean;
  interactive?: boolean;
  /** When false the WebView pauses its render loop to save battery/memory. */
  active?: boolean;
  onCountryTap?: (lat: number, lon: number) => void;
  onReady?: () => void;
  selectedLatLon?: { lat: number; lon: number } | null;
}

type GlobeCommand =
  | { type: 'selectCountry'; lat: number; lon: number }
  | { type: 'clearSelection' }
  | { type: 'setAutoRotate'; value: boolean }
  | { type: 'setInteractive'; value: boolean }
  | { type: 'setRenderActive'; value: boolean };

export function GlobeView({
  autoRotate = false,
  interactive = true,
  active = true,
  onCountryTap,
  onReady,
  selectedLatLon,
}: GlobeViewProps) {
  const webviewRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  // Commands issued before the globe page signalled `ready` are replayed on ready.
  const pendingRef = useRef<GlobeCommand[]>([]);
  const [, forceRender] = useState(0);

  const config = JSON.stringify({ autoRotate, interactive });
  const injectedJS = `window.GLOBE_CONFIG=${config};true;`;

  const send = useCallback((cmd: GlobeCommand) => {
    if (!readyRef.current || !webviewRef.current) {
      // Keep only the latest command of each kind so the replay reflects
      // the current desired state rather than a stale history.
      pendingRef.current = pendingRef.current.filter(c =>
        cmd.type === 'selectCountry' || cmd.type === 'clearSelection'
          ? c.type !== 'selectCountry' && c.type !== 'clearSelection'
          : c.type !== cmd.type,
      );
      pendingRef.current.push(cmd);
      return;
    }
    const js = `if(window.__globeMsg)window.__globeMsg(${JSON.stringify(JSON.stringify(cmd))});true;`;
    webviewRef.current.injectJavaScript(js);
  }, []);

  // Keep selection in sync (fires on mount too, so it is queued until ready).
  useEffect(() => {
    if (selectedLatLon) {
      send({ type: 'selectCountry', lat: selectedLatLon.lat, lon: selectedLatLon.lon });
    } else {
      send({ type: 'clearSelection' });
    }
  }, [selectedLatLon, send]);

  useEffect(() => {
    send({ type: 'setAutoRotate', value: autoRotate });
  }, [autoRotate, send]);

  useEffect(() => {
    send({ type: 'setInteractive', value: interactive });
  }, [interactive, send]);

  useEffect(() => {
    send({ type: 'setRenderActive', value: active });
  }, [active, send]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type: string;
        lat?: number;
        lon?: number;
      };
      if (data.type === 'tap' && onCountryTap && data.lat !== undefined && data.lon !== undefined) {
        onCountryTap(data.lat, data.lon);
      } else if (data.type === 'ready') {
        readyRef.current = true;
        const queued = pendingRef.current;
        pendingRef.current = [];
        queued.forEach(send);
        onReady?.();
      }
    } catch {
      // ignore parse errors
    }
  };

  // A reload (e.g. after a crash) invalidates readiness.
  const handleLoadStart = () => {
    readyRef.current = false;
    forceRender(n => n + 1);
  };

  // WebView is not available on web platform — render a placeholder
  if (Platform.OS === 'web') {
    return <View style={styles.webPlaceholder} />;
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
      onLoadStart={handleLoadStart}
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

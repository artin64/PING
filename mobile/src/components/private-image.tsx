import { useEffect, useState } from 'react';
import { Image, Platform, View, type ImageResizeMode, type ImageStyle } from 'react-native';

import { TextBlock } from '@/components/ui';
import { attachmentUrl } from '@/lib/api';
import { usePingoTheme } from '@/lib/theme';

export function PrivateImage({ path, token, style, resizeMode = 'cover' }: {
  path: string;
  token: string | null;
  style: ImageStyle;
  resizeMode?: ImageResizeMode;
}) {
  const colors = usePingoTheme();
  const remoteUrl = attachmentUrl(path);
  const key = `${remoteUrl || ''}|${token || ''}`;
  const [webImage, setWebImage] = useState<{ key: string; uri: string | null; failed: boolean } | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!remoteUrl || !token) {
      return;
    }

    const controller = new AbortController();
    let objectUrl: string | null = null;
    fetch(remoteUrl, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Attachment request failed (${response.status})`);
        return response.blob();
      })
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setWebImage({ key, uri: objectUrl, failed: false });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setWebImage({ key, uri: null, failed: true });
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [key, remoteUrl, token]);

  const native = Platform.OS !== 'web';
  const currentWebImage = webImage?.key === key ? webImage : null;
  if (native ? !remoteUrl : !remoteUrl || !token || currentWebImage?.failed) {
    return <View style={[style, { backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }]}><TextBlock size="small" color={colors.secondary}>Image unavailable</TextBlock></View>;
  }
  const uri = native ? remoteUrl : currentWebImage?.uri;
  if (!uri) return <View style={[style, { backgroundColor: colors.surfaceMuted }]} />;

  return (
    <Image
      source={{ uri, ...(native ? { headers: token ? { Authorization: `Bearer ${token}` } : {} } : {}) }}
      style={style}
      resizeMode={resizeMode}
      accessibilityLabel="Private saved image"
    />
  );
}


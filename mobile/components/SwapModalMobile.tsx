import React, { useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Modal } from 'react-native';
import { WebView } from 'react-native-webview';

interface SwapModalProps {
  visible: boolean;
  onClose: () => void;
  webAppUrl: string; // Your deployed web app URL
}

export default function SwapModalMobile({ visible, onClose, webAppUrl }: SwapModalProps) {
  const webViewRef = useRef<WebView>(null);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.action === 'close') {
        onClose();
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Token Swap</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
        
        <WebView
          ref={webViewRef}
          source={{ uri: `${webAppUrl}/mobile/swap` }}
          style={styles.webview}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          injectedJavaScript={`
            window.ReactNativeWebView = window.ReactNativeWebView || {};
          `}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a24',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a34',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2a2a34',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#ffffff',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
});

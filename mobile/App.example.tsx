import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import SwapModalMobile from './mobile/components/SwapModalMobile';
import BuyModalMobile from './mobile/components/BuyModalMobile';

const WEB_APP_URL = 'https://your-app.com'; // Replace with your Netlify URL

export default function App() {
  const [swapModalVisible, setSwapModalVisible] = useState(false);
  const [buyModalVisible, setBuyModalVisible] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>BTC1USD Mobile</Text>
        
        <TouchableOpacity 
          style={styles.button}
          onPress={() => setSwapModalVisible(true)}
        >
          <Text style={styles.buttonText}>🔄 Open Swap</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.buyButton}
          onPress={() => setBuyModalVisible(true)}
        >
          <Text style={styles.buttonText}>💳 Open BuyX</Text>
        </TouchableOpacity>
      </View>

      <SwapModalMobile
        visible={swapModalVisible}
        onClose={() => setSwapModalVisible(false)}
        webAppUrl={WEB_APP_URL}
      />

      <BuyModalMobile
        visible={buyModalVisible}
        onClose={() => setBuyModalVisible(false)}
        webAppUrl={WEB_APP_URL}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    width: '80%',
  },
  buyButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    width: '80%',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});

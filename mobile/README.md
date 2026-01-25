# React Native Integration for BTC1USD

## Setup Instructions

### 1. Install Dependencies

```bash
npm install react-native-webview
# or
yarn add react-native-webview
```

### 2. Configure iOS (if using iOS)

```bash
cd ios && pod install && cd ..
```

### 3. Update Your Web App URL

In `mobile/App.example.tsx`, replace:
```typescript
const WEB_APP_URL = 'https://your-app.com';
```

With your actual Netlify URL:
```typescript
const WEB_APP_URL = 'https://your-netlify-app.netlify.app';
```

### 4. Copy Components to Your React Native Project

Copy these files to your React Native project:
- `mobile/components/SwapModalMobile.tsx`
- `mobile/components/BuyModalMobile.tsx`
- `mobile/App.example.tsx` (rename to App.tsx or integrate into your app)

### 5. Usage Example

```typescript
import SwapModalMobile from './components/SwapModalMobile';
import BuyModalMobile from './components/BuyModalMobile';

function YourScreen() {
  const [showSwap, setShowSwap] = useState(false);
  const [showBuy, setShowBuy] = useState(false);

  return (
    <View>
      <Button title="Swap Tokens" onPress={() => setShowSwap(true)} />
      <Button title="Buy Crypto" onPress={() => setShowBuy(true)} />

      <SwapModalMobile
        visible={showSwap}
        onClose={() => setShowSwap(false)}
        webAppUrl="https://your-app.netlify.app"
      />

      <BuyModalMobile
        visible={showBuy}
        onClose={() => setShowBuy(false)}
        webAppUrl="https://your-app.netlify.app"
      />
    </View>
  );
}
```

## How It Works

1. **Web Routes**: `/mobile/swap` and `/mobile/buy` render the modals full-screen
2. **WebView Bridge**: React Native WebView loads these routes
3. **Communication**: WebView postMessage sends close events to React Native
4. **Native Modal**: React Native Modal wraps the WebView for native feel

## Features

✅ Full wallet connection support (Thirdweb in-app wallet)
✅ Native modal animations
✅ Cross-platform (iOS & Android)
✅ Secure communication between web and native
✅ Beautiful UI matching your web app
✅ Responsive design

## Endpoints

- Swap Modal: `https://your-app.com/mobile/swap`
- Buy Modal: `https://your-app.com/mobile/buy`

## Testing Locally

1. Start your Next.js dev server:
```bash
npm run dev
```

2. In React Native, use your local IP:
```typescript
const WEB_APP_URL = 'http://192.168.1.100:3000';
```

3. Run your React Native app:
```bash
npm run ios
# or
npm run android
```

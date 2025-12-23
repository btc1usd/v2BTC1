import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Web3Provider } from "@/lib/web3-provider";
import { WagmiProviderComponent } from "@/lib/wagmi-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { NetworkGuard } from "@/components/network-guard";

export const metadata: Metadata = {
  title: "BTC1USD Protocol",
  description: "Shariah-compliant Bitcoin-backed stable asset management",
  generator: "v0.app",
  icons: {
    icon: '/favicon.png',
  },
};

export function generateViewport() {
  return {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    themeColor: [
      { media: '(prefers-color-scheme: light)', color: '#FAFAFA' },
      { media: '(prefers-color-scheme: dark)', color: '#1E293B' },
    ],
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="color-scheme" content="dark light" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('btc1usd-theme') || 'dark';
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                    document.documentElement.style.colorScheme = 'dark';
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.style.colorScheme = 'light';
                  }
                } catch (e) {
                  // If localStorage is not available (MetaMask browser), default to dark
                  document.documentElement.classList.add('dark');
                  document.documentElement.style.colorScheme = 'dark';
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          storageKey="btc1usd-theme"
          disableTransitionOnChange
        >
          <WagmiProviderComponent>
            <Web3Provider>
              <NetworkGuard />
              {children}
            </Web3Provider>
          </WagmiProviderComponent>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
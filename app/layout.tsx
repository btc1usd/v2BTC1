import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Web3Provider } from "@/lib/web3-provider";
import { WagmiProviderComponent } from "@/lib/wagmi-provider";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "BTC1USD Protocol",
  description: "Shariah-compliant Bitcoin-backed stable asset management",
  generator: "v0.app",
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          storageKey="btc1usd-theme"
          disableTransitionOnChange
        >
          <WagmiProviderComponent>
            <Web3Provider>{children}</Web3Provider>
          </WagmiProviderComponent>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
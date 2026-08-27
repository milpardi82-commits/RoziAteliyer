import './globals.css';
import type { Metadata } from 'next';
import { Fraunces, Inter, Vazirmatn } from 'next/font/google';
import { LocaleProvider } from '@/components/locale-provider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

const vazirmatn = Vazirmatn({
  subsets: ['arabic'],
  variable: '--font-vazirmatn',
  display: 'swap',
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://roziatelye.com'),
  title: 'رُزی آتلیه — آتلیه‌ای برای طراحی اصیل',
  description: 'طراحی‌های اصلی سطح را از هنرمندان مستقل سراسر جهان کشف کنید.',
  openGraph: {
    title: 'رُزی آتلیه — آتلیه‌ای برای طراحی اصیل',
    description: 'طراحی‌های اصلی سطح را از هنرمندان مستقل سراسر جهان کشف کنید.',
    images: ['https://images.pexels.com/photos/5117322/pexels-photo-5117322.jpeg?auto=compress&cs=tinysrgb&w=1200&h=630&fit=crop'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className={`${inter.variable} ${fraunces.variable} ${vazirmatn.variable} ${inter.className}`}>
        <LocaleProvider locale="fa">{children}</LocaleProvider>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'EmotionIQ — Customer Emotion & Offer Intelligence',
  description:
    'AI-powered platform to detect emotions in customer messages and auto-assign personalized offers. Built for CX, support, and growth teams.',
  keywords: ['emotion detection', 'NLP', 'customer experience', 'offer mapping', 'AI', 'sentiment analysis'],
  openGraph: {
    title: 'EmotionIQ',
    description: 'Detect customer emotions, assign smart offers — at scale.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );
}

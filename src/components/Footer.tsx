import { protoMono } from '../styles/fonts';

export default function Footer() {
  return (
    <footer className={`text-center py-4 text-gray-400 text-sm ${protoMono.className}`}>
      made with <span className="text-red-500 text-lg">❤</span> during ETH Denver
    </footer>
  );
} 
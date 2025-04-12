import { protoMono } from '../styles/fonts';

interface LoaderProps {
  message?: string;
}

export default function Loader({ message = "Loading..." }: LoaderProps) {
  return (
    <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin"></div>
        <p className={protoMono.className}>{message}</p>
      </div>
    </div>
  );
} 
import { protoMono } from '../styles/fonts';

interface HealthMetricProps {
  title: string;
  value: number;
  unit: string;
  icon: string;
}

export function HealthMetric({ title, value, unit, icon }: HealthMetricProps) {
  return (
    <div className="bg-gray-900 border-2 border-gray-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-xl font-bold ${protoMono.className}`}>
          {icon} {title}
        </h2>
      </div>
      <div className="flex items-baseline">
        <span className={`text-4xl font-bold text-green-400 ${protoMono.className}`}>
          {value.toLocaleString()}
        </span>
        <span className={`ml-2 text-gray-400 ${protoMono.className}`}>
          {unit}
        </span>
      </div>
    </div>
  );
} 
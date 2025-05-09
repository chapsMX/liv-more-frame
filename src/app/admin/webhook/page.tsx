import WebhookConfig from '../../../components/WebhookConfig';

export default function WebhookPage() {
  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-2xl font-bold mb-6 text-center">LivMore Admin - Webhook Configuration</h1>
      <WebhookConfig />
    </div>
  );
} 
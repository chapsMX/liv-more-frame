import { Metadata } from 'next';
import CallbackClient from './callback-client';

export const metadata: Metadata = {
  title: 'Google Auth Callback',
};

export default async function Page({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return <CallbackClient searchParams={searchParams} />;
}





  
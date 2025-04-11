import { Metadata } from 'next';
import CallbackClient from './callback-client';

export const metadata: Metadata = {
  title: 'Google Auth Callback',
};

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default function Page({ searchParams }: PageProps) {
  return <CallbackClient searchParams={searchParams} />;
}



  
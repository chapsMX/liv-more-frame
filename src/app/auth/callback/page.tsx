import { Metadata } from 'next';
import CallbackClient from './callback-client';

export const metadata: Metadata = {
  title: 'Google Auth Callback',
};

export default function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  return <CallbackClient searchParams={searchParams} />;
}




  
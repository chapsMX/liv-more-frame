type SearchParamsType = {
  code?: string;
  state?: string;
  error?: string;
}

export type PageProps = {
  params: { [key: string]: string };
  searchParams: SearchParamsType;
} 
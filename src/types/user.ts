/** Public user from GET/POST/PATCH /api/user (no tokens) */
export type AppUser = {
  id: number;
  fid: number | null;
  username?: string | null;
  display_name?: string | null;
  basename?: string | null;
  eth_address?: string | null;
  created_at: string;
  updated_at: string;
  provider: "garmin" | "polar" | "oura" | "google" | null;
  og: boolean;
  auth_type?: "farcaster" | "wallet";
};

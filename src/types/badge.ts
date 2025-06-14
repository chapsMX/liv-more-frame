export interface Badge {
  id: number;
  name: string;
  badge_type: string;
  total_supply: number;
  category: string;
  image_url: string;
  description: string;
  metadata: BadgeMetadata;
  created_at: string;
  earned_at?: string;
  total_earned?: number;
}

export interface BadgeMetadata {
  name: string;
  description: string;
  badge_type: string;
  category: string;
  image: string;
}

export interface CreateBadgeRequest {
  name: string;
  badge_type: string;
  total_supply: number;
  category: string;
  image_url: string;
  description: string;
  metadata: BadgeMetadata;
} 
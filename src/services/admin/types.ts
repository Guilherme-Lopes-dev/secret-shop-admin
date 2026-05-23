export interface PassTierEntry {
  rank:          number
  name:          string
  color:         string
  min_spent_brl: number
  min_points:    number
  unlocked:      boolean
  is_current:    boolean
}

export interface PassProgressDto {
  pass_active:         boolean
  season_start:        string | null
  season_end:          string | null
  current_tier:        { rank: number; name: string }
  next_tier:           { rank: number; name: string; min_points: number } | null
  points_balance:      number
  total_spent_brl:     number
  progress_percent:    number
  points_to_next_tier: number | null
  cashback_benefit:    { percentage: number } | null
  decay_info:          { inactivity_days_trigger: number; weekly_decay_points: number }
  all_tiers:           PassTierEntry[]
}

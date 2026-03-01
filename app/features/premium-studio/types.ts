/**
 * Premium Studio — shared types for captions and chat/sexting sessions.
 */

export type CaptionTone = "" | "flirty" | "casual" | "motivational" | "premium" | "tease";
export type CaptionLength = "" | "short" | "medium" | "long";

export interface GenerateCaptionRequest {
  imageUrl?: string;
  imageUrls?: string[];
  hasVideo?: boolean;
  bio?: string;
  tone?: CaptionTone;
  length?: CaptionLength;
  starterText?: string;
  count?: number;
  formality?: number;
  humor?: number;
  empathy?: number;
  profanity?: number;
  spiciness?: number;
}

export interface GenerateCaptionResponse {
  captions: string[];
  error?: string;
}

export interface SextingContextMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateSextingSuggestionRequest {
  recentMessages: SextingContextMessage[];
  fanName?: string;
  creatorPersona?: string;
  tone?: "playful" | "intimate" | "tease" | "sweet";
  numSuggestions?: number;
  formality?: number;
  humor?: number;
  empathy?: number;
  profanity?: number;
  spiciness?: number;
  /** When true, AI should gently wrap up the session and soft upsell, not pushy. */
  wrappingUp?: boolean;
  /** Optional context from previous sessions with this fan (e.g. what they like). */
  fanSessionContext?: string;
}

export interface GenerateSextingSuggestionResponse {
  suggestion: string;
  suggestions?: string[];
  error?: string;
}

export interface UsageLimit {
  captionGenerationsRemaining: number;
  aiSuggestionsRemaining: number;
  limitPeriod: "day" | "month";
}

export interface FanOption {
  uid: string;
  displayName: string | null;
  email: string | null;
  memberId?: string;
}

// --- Interactive Post Ideas ---
export interface InteractiveIdea {
  title?: string;
  post_caption?: string;
  interaction_mechanic?: string;
  cta?: string;
  dm_followup_trigger?: string;
  why_it_should_work?: string;
}

export interface AbTestVariant {
  test?: string;
  variant_a?: string;
  variant_b?: string;
  success_metric?: string;
}

export interface GenerateInteractiveIdeasRequest {
  tone_suggestion?: string;
  interactive_focus?: string;
  creator_voice?: string;
  fan_profile?: string;
  creator_gender?: string;
  target_audience_gender?: string;
  objective?: string;
  constraints?: string;
  formality?: number;
  humor?: number;
  empathy?: number;
  profanity?: number;
  spiciness?: number;
}

export interface GenerateInteractiveIdeasResponse {
  tone_used?: string;
  ideas?: InteractiveIdea[];
  ab_test_variants?: AbTestVariant[];
  error?: string;
}

// --- Rating Short ---
export interface RatingShortPrompt {
  prompt_text?: string;
  angle?: string;
  cta?: string;
  upsell_path?: string;
}

export interface GenerateRatingPromptsRequest {
  tone_suggestion?: string;
  rating_subject: string;
  creator_voice?: string;
  fan_profile?: string;
  creator_gender?: string;
  target_audience_gender?: string;
  constraints?: string;
  formality?: number;
  humor?: number;
  empathy?: number;
  profanity?: number;
  spiciness?: number;
}

export interface GenerateRatingPromptsResponse {
  tone_used?: string;
  rating_subject?: string;
  prompts?: RatingShortPrompt[];
  best_3_for_conversion?: string[];
  error?: string;
}

// --- Rating Long ---
export interface GenerateRatingLongRequest {
  tone_suggestion?: string;
  long_rating_subject: string;
  fan_details: string;
  creator_voice?: string;
  fan_profile?: string;
  creator_gender?: string;
  target_audience_gender?: string;
  constraints?: string;
  desired_length?: string;
  formality?: number;
  humor?: number;
  empathy?: number;
  profanity?: number;
  spiciness?: number;
}

export interface GenerateRatingLongResponse {
  tone_used?: string;
  overall_score?: string;
  rating_response?: string;
  section_summary?: {
    opening?: string;
    assessment?: string;
    details?: string;
    personalization?: string;
    closing_cta?: string;
  };
  follow_up_options?: string[];
  error?: string;
}

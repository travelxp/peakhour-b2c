/**
 * Composer foundation primitives — the shared widget kit every
 * peakhour-b2c publish surface mounts on top of (X, LinkedIn,
 * Beehiiv, Strategist publish tab, calendar "+ compose new").
 *
 * Each primitive ships with:
 *   - A handler-callback interface (the host owns the network).
 *   - Zero backend dependencies in this PR — composers in PR #3/#4
 *     thread the actual API endpoints into these handlers.
 *   - Premium-feel UI built on the existing shadcn UI primitives +
 *     the shadcnblocks PRO emoji-picker block.
 *
 * See [[project_composer_scheduler_buildout]] in peakhour-mongodb
 * memory for the master plan + decision history.
 */

export { AiComposeToolbar } from "./ai-compose-toolbar";
export type { AiComposeToolbarProps } from "./ai-compose-toolbar";

export { ComposerCommandPalette } from "./composer-command-palette";
export type {
  ComposerCommandPaletteProps,
  ComposerCommand,
} from "./composer-command-palette";

export { DraftSaver, useDraftSaver } from "./draft-saver";
export type {
  DraftSaverProps,
  UseDraftSaverOptions,
  UseDraftSaverResult,
} from "./draft-saver";

export { EmojiPickerTrigger } from "./emoji-picker-trigger";
export type { EmojiPickerTriggerProps } from "./emoji-picker-trigger";

export { HashtagSuggest } from "./hashtag-suggest";
export type { HashtagSuggestProps } from "./hashtag-suggest";

export { MediaPicker } from "./media-picker";
export type { MediaPickerProps } from "./media-picker";

export { MentionTypeahead } from "./mention-typeahead";
export type { MentionTypeaheadProps } from "./mention-typeahead";

export { PlatformCharCounter } from "./platform-char-counter";
export type { PlatformCharCounterProps } from "./platform-char-counter";

export { VoiceCardPreview } from "./voice-card-preview";
export type { VoiceCardPreviewProps } from "./voice-card-preview";

// Shared types — re-exported so consumers can import everything from
// "@/components/composer" instead of reaching into individual files.
export {
  PLATFORM_LIMITS,
} from "./types";
export type {
  AiActionContext,
  DraftSaveStatus,
  HashtagCandidate,
  MediaAsset,
  MentionCandidate,
  PlatformKey,
  PlatformLimits,
  RewriteOp,
  VoiceCardSummary,
} from "./types";

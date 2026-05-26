/**
 * Reusable scheduler UI primitives — the @peakhour/scheduler-ui kit
 * inlined in the b2c codebase. Every primitive is presentational +
 * controlled (parent owns state); the only side-effects live in
 * `useSchedulePreview` (debounced API preview).
 *
 * Plan reference: peakhour-mongodb/docs/idea/content-pipeline-hardening.md
 * §2.3 — "Reusable UI primitives" list.
 */

export { ScheduleTimePicker } from "./schedule-time-picker";
export type { ScheduleTimePickerProps } from "./schedule-time-picker";

export { StaggerStrategyChooser } from "./stagger-strategy-chooser";
export type { StaggerStrategyChooserProps } from "./stagger-strategy-chooser";

export { ScheduleConfirmCard } from "./schedule-confirm-card";
export type { ScheduleConfirmCardProps } from "./schedule-confirm-card";

export {
  PublishBundleSummary,
  NextActionScheduleSlot,
} from "./publish-bundle-summary";
export type { PublishBundleSummaryProps } from "./publish-bundle-summary";

export { TimezoneBanner } from "./timezone-banner";
export type { TimezoneBannerProps } from "./timezone-banner";

export { ScheduleConflictWarning } from "./schedule-conflict-warning";
export type { ScheduleConflictWarningProps } from "./schedule-conflict-warning";

export { RecurringScheduleEditor } from "./recurring-schedule-editor";
export type {
  RecurringScheduleEditorProps,
  RecurringRuleInput,
  RecurringFreq,
} from "./recurring-schedule-editor";

export { CalendarView } from "./calendar-view";
export type { CalendarViewProps } from "./calendar-view";

export { useSchedulePreview } from "./use-schedule-preview";

export { SchedulerComposer } from "./scheduler-composer";
export type { SchedulerComposerProps } from "./scheduler-composer";

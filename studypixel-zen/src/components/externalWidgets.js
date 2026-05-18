import { MCQWidget } from '../widgets/components/MCQWidget.js';
import { MCQReasoningWidget } from '../widgets/components/MCQReasoningWidget.js';
import FlashcardWidget from '../widgets/components/FlashcardWidget.js';
import FillBlankWidget from '../widgets/components/FillBlankWidget.js';
import MatchingWidget from '../widgets/components/MatchingWidget.js';
import TimelineWidget from '../widgets/components/TimelineWidget.js';
import AnalogyWidget from '../widgets/components/AnalogyWidget.js';
import SpacedReviewWidget from '../widgets/components/SpacedReviewWidget.js';
import { DiagramGeneratorWidget } from '../widgets/components/DiagramGeneratorWidget.js';
import { SignalComparisonWidget } from '../widgets/components/SignalComparisonWidget.js';
import { TacticalSandboxWidget } from '../widgets/components/TacticalSandboxWidget.js';
import ImageAnalysisWidget from '../widgets/components/ImageAnalysisWidget.js';
import { disabledInitially, getEnabledWidgets, optionalWidgets, requiredWidgets } from '../widgets/widgetPolicy';

export const widgetCatalog = {
  'mcq-v1': MCQWidget,
  'mcq-reasoning-v1': MCQReasoningWidget,
  'flashcard-v1': FlashcardWidget,
  'fill-blank-v1': FillBlankWidget,
  'matching-v1': MatchingWidget,
  'timeline-v1': TimelineWidget,
  'analogy-v1': AnalogyWidget,
  'spaced-review-v1': SpacedReviewWidget,
  'diagram-generator-v1': DiagramGeneratorWidget,
  'signal-comparison-v1': SignalComparisonWidget,
  'tactical-sandbox-v1': TacticalSandboxWidget,
  'image-analysis-v1': ImageAnalysisWidget,
};

export const widgetPolicy = {
  required: requiredWidgets,
  optional: optionalWidgets,
  disabledInitially,
  enabled: requiredWidgets,
};

export { getEnabledWidgets };

export function getEnabledWidgetIds(options) {
  return getEnabledWidgets(options);
}

import { MCQWidget } from '../../../studypixel/src/components/pixelbot/widgets/MCQWidget.js';
import { MCQReasoningWidget } from '../../../studypixel/src/components/pixelbot/widgets/MCQReasoningWidget.js';
import FlashcardWidget from '../../../studypixel/src/components/pixelbot/widgets/FlashcardWidget.js';
import FillBlankWidget from '../../../studypixel/src/components/pixelbot/widgets/FillBlankWidget.js';
import MatchingWidget from '../../../studypixel/src/components/pixelbot/widgets/MatchingWidget.js';
import TimelineWidget from '../../../studypixel/src/components/pixelbot/widgets/TimelineWidget.js';
import AnalogyWidget from '../../../studypixel/src/components/pixelbot/widgets/AnalogyWidget.js';
import SpacedReviewWidget from '../../../studypixel/src/components/pixelbot/widgets/SpacedReviewWidget.js';
import { DiagramGeneratorWidget } from '../../../studypixel/src/components/pixelbot/widgets/DiagramGeneratorWidget.js';
import { SignalComparisonWidget } from '../../../studypixel/src/components/pixelbot/widgets/SignalComparisonWidget.js';

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
};

export const widgetPolicy = {
  enabled: ['mcq-v1', 'mcq-reasoning-v1', 'flashcard-v1', 'fill-blank-v1', 'matching-v1', 'timeline-v1', 'analogy-v1', 'spaced-review-v1', 'diagram-generator-v1', 'signal-comparison-v1'],
  disabledInitially: ['tactical-sandbox-v1', 'image-analysis-v1'],
};

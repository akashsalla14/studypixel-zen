import { MCQBaseWidget } from './MCQBaseWidget';

/**
 * MCQ Reasoning Widget
 * Displays a multiple choice question requiring written justification.
 */
export function MCQReasoningWidget({ data, onSubmit }) {
  return (
    <MCQBaseWidget
      data={data}
      onSubmit={onSubmit}
      requiresReasoning={true}
      widgetId="mcq-reasoning-v1"
      defaultTags={['Assessment', 'Reasoning']}
    />
  );
}

export default MCQReasoningWidget;
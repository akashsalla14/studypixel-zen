import { MCQBaseWidget } from './MCQBaseWidget';

/**
 * MCQWidget
 * Handles 'mcq-v1' widget type.
 */
export const MCQWidget = ({ data, onSubmit }) => {
  return (
    <MCQBaseWidget
      data={data}
      onSubmit={onSubmit}
      requiresReasoning={data?.requiresReasoning === true}
      widgetId={data?.requiresReasoning === true ? 'mcq-reasoning-v1' : 'mcq-v1'}
      defaultTags={['Assessment', 'Multiple Choice']}
    />
  );
};

export default MCQWidget;
import React from 'react';

interface Props {
  resistance: string;
  tolerance: string;
  invalid: boolean;
  onResistanceChange: (text: string) => void;
  onToleranceChange: (text: string) => void;
}

export default function InputFields({
  resistance,
  tolerance,
  invalid,
  onResistanceChange,
  onToleranceChange,
}: Props) {
  return (
    <div id="input" className={invalid ? 'invalid' : ''}>
      <div id="inputdata">
        <span
          id="resistance"
          contentEditable
          suppressContentEditableWarning
          onInput={e => onResistanceChange(e.currentTarget.textContent || '')}
        >
          {resistance}
        </span>{' '}
        <span
          id="tolerance"
          contentEditable
          suppressContentEditableWarning
          onInput={e => onToleranceChange(e.currentTarget.textContent || '')}
        >
          {tolerance}
        </span>
      </div>
    </div>
  );
}

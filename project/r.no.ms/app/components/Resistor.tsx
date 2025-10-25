import { niceColours } from '../resistor';

interface Props {
  bands: string[];
  onBandInput: (index: number, value: string) => void;
  onBandClick: (index: number) => void;
}

export default function Resistor({ bands, onBandInput, onBandClick }: Props) {
  return (
    <div id="resistor">
      {bands.map((band, index) => (
        <div
          key={index}
          className="stripe"
          style={{ backgroundColor: niceColours[band] ?? band }}
        >
          <div
            className="label"
            contentEditable
            suppressContentEditableWarning
            onInput={e => onBandInput(index, e.currentTarget.textContent || '')}
            onClick={() => onBandClick(index)}
          >
            {band}
          </div>
        </div>
      ))}
    </div>
  );
}

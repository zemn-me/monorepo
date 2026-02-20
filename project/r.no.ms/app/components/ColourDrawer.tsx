import { niceColours } from '../resistor';

interface Props {
  visible: boolean;
  colours: string[];
  onSelect: (colour: string) => void;
  onClose: () => void;
}

export default function ColourDrawer({ visible, colours, onSelect, onClose }: Props) {
  return (
    <>
      <input
        id="showcolourdrawer"
        type="checkbox"
        style={{ display: 'none' }}
        checked={visible}
        onChange={onClose}
      />
      <label htmlFor="showcolourdrawer">
        <div id="colourdrawer">
          <div id="colourselector">
            {colours.map(c => (
              <div
                key={c}
                className="swatch"
                data-colour={c}
                style={{ backgroundColor: niceColours[c] ?? c }}
                onClick={() => onSelect(c)}
              />
            ))}
          </div>
        </div>
      </label>
    </>
  );
}

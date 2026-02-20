"use client";

import { useEffect, useState } from 'react';
import ColourDrawer from './components/ColourDrawer';
import Footer from './components/Footer';
import InputFields from './components/InputFields';
import Resistor from './components/Resistor';
import { Resistor as ResistorModel, parseSi, renderScientificSi } from './resistor';

export default function Page() {
  const [resistor, setResistor] = useState(new ResistorModel(100e3, 5));
  const [resistance, setResistance] = useState('');
  const [tolerance, setTolerance] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedBand, setSelectedBand] = useState<number | null>(null);

  useEffect(() => {
    setResistance(renderScientificSi(resistor.resistance));
    setTolerance(String(resistor.tolerance));
    setMobile(/mobile/g.test(navigator.userAgent.toLowerCase()));
  }, [resistor]);

  const bands = resistor.bands();

  const handleResistanceChange = (text: string) => {
    setResistance(text);
    const r = parseSi(text) || 0;
    const nR = new ResistorModel(r, Number(tolerance));
    if (nR.invalid()) {
      setInvalid(true);
    } else {
      setInvalid(false);
      setResistor(nR);
    }
  };

  const handleToleranceChange = (text: string) => {
    setTolerance(text);
    const nR = new ResistorModel(parseSi(resistance) || 0, Number(text));
    if (nR.invalid()) {
      setInvalid(true);
    } else {
      setInvalid(false);
      setResistor(nR);
    }
  };

  const handleBandInput = (index: number, value: string) => {
    const labels = bands.map((b, i) =>
      i === index
        ? value.trim().toLowerCase().replace(/none|empty|absent/, 'transparent').replace(/grey/, 'gray')
        : b,
    );
    const nR = ResistorModel.fromBands(...labels);
    if (nR.invalid()) {
      setInvalid(true);
    } else {
      setInvalid(false);
      setResistor(nR);
      setResistance(renderScientificSi(nR.resistance));
      setTolerance(String(nR.tolerance));
    }
  };

  const handleBandClick = (index: number) => {
    if (mobile) {
      setSelectedBand(index);
      setDrawerVisible(true);
    }
  };

  const colourLabels = Array.from(
    new Set([
      ...Object.keys(ResistorModel.reverseNumericColorMap),
      ...Object.keys(ResistorModel.reverseToleranceMap),
    ]),
  );

  const handleSelectColour = (colour: string) => {
    if (selectedBand !== null) {
      handleBandInput(selectedBand, colour);
      setDrawerVisible(false);
      setSelectedBand(null);
    }
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setSelectedBand(null);
  };

  return (
    <>
      <Resistor bands={bands} onBandInput={handleBandInput} onBandClick={handleBandClick} />
      <InputFields
        resistance={resistance}
        tolerance={tolerance}
        invalid={invalid}
        onResistanceChange={handleResistanceChange}
        onToleranceChange={handleToleranceChange}
      />
      <Footer />
      <ColourDrawer
        visible={drawerVisible}
        colours={colourLabels}
        onSelect={handleSelectColour}
        onClose={handleCloseDrawer}
      />
    </>
  );
}

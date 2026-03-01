"use client";

import { useState } from "react";

import { ChipInput } from "#root/project/zemn.me/components/ChipInput/chip_input.js";


export default function ChipInputClient() {
	const [input, setInput] = useState('');

	return <ChipInput
		join={s => s.join(' ')}
		onChange={s => setInput(s)}
		split={s => s.split(' ')}
		value={input}
	/>;

}

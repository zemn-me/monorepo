'use client';
import React from 'react';

import exampleSave from '#root/project/cultist/example/savestate.js';
import * as Board from '#root/project/cultist/react/table.js';
import * as Save from '#root/project/cultist/save.js';
import * as State from '#root/project/cultist/state/index.js';

const Home = (): React.ReactElement => {
	const [state, setState] = React.useState(
		State.deserialize.state(Save.load(JSON.stringify(exampleSave)))
	);

	const onElementChange = React.useCallback(
		(elementKey: string, newElement: State.ElementInstance) =>
			setState(s =>
				s.set(
					'elementStacks',
					s.elementStacks!.set(elementKey, newElement)
				)
			),
		[setState]
	);

	return (
		<React.StrictMode>
			<h1>Cultist</h1>
			<p>This is a very old project from the pandemic to simulate the game Cultist Simulator in React.</p>
			<Board.Table onElementChange={onElementChange} state={state} />

			<textarea
				readOnly
				style={{ width: '100%' }}
				value={JSON.stringify(State.serialize.state(state), null, 2)}
			/>
		</React.StrictMode>
	);
};

export default Home;

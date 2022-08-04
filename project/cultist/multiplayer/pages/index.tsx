import React from 'react';
import exampleSave from 'monorepo/project/cultist/example/savestate';

import * as State from 'monorepo/project/cultist/state';
import * as Save from 'monorepo/project/cultist/save';
import * as Board from 'monorepo/project/cultist/react/table';

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
			<Board.Table onElementChange={onElementChange} state={state} />

			<textarea
				style={{ width: '100%' }}
				readOnly
				value={JSON.stringify(State.serialize.state(state), null, 2)}
			/>
		</React.StrictMode>
	);
};

export default Home;

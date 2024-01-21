import exampleSave from 'project/cultist/example/savestate';
import * as Board from 'project/cultist/react/table';
import * as Save from 'project/cultist/save';
import * as State from 'project/cultist/state';
import React from 'react';

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
				readOnly
				style={{ width: '100%' }}
				value={JSON.stringify(State.serialize.state(state), null, 2)}
			/>
		</React.StrictMode>
	);
};

export default Home;

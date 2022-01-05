import React from 'react';
import exampleSave from 'project/cultist/example/savestate';

import * as State from 'project/cultist/state';
import * as Save from 'project/cultist/save';
import * as Board from 'project/cultist/react/board';

const Home = (): React.ReactElement => (
	<React.StrictMode>
		<Board.Board
			state={State.deserialize.state(
				Save.load(JSON.stringify(exampleSave))
			)}
		/>
	</React.StrictMode>
);

export default Home;

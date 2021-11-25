import React from 'react';
import exampleSave from '//project/cultist/example/savestate';

// local imports (not NPM) seem to be broken...

import * as State from '//project/cultist/state';
import * as Save from '//project/cultist/save';
import * as Board from '//project/cultist/react/board';

const Home = (): React.ReactElement => (
	<>
		<Board.Board
			state={State.deserialize.state(
				Save.load(JSON.stringify(exampleSave))
			)}
		/>
	</>
);

export default Home;

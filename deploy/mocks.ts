export const Github = {
	rest: {
		repos: {
			uploadReleaseAsset({
				owner,
				repo,
				release_id,
			}: {
				owner: string;
				repo: string;
				release_id: number;
			}) {
				if (!owner)
					throw new Error('invalid release asset: missing owner.');
				if (!repo)
					throw new Error('invalid release asset: missing repo.');
				if (!release_id)
					throw new Error(
						'invalid release asset: missing release_id.'
					);
			},

			createRelease({
				owner,
				repo,
				tag_name,
				body,
				generate_release_notes,
				name,
				target_commitish,
			}: {
				owner: string;
				repo: string;
				tag_name: string;
				body: string;
				generate_release_notes: boolean;
				name: string;
				target_commitish: string;
			}) {
				for (const v of [
					owner,
					repo,
					tag_name,
					body,
					generate_release_notes,
					name,
					target_commitish,
				]) {
					if (v === undefined || v === null || v === '')
						throw new Error(
							`A parameter is empty. ${JSON.stringify({
								owner,
								repo,
								tag_name,
								body,
								generate_release_notes,
								name,
								target_commitish,
							})}`
						);
				}
				return { data: { id: 9000 } };
			},
		},
	},
};

export const context = {
	sha: '123fakesha',
	ref: '123fakeref!',
	repo: {
		owner: 'fake!',
		repo: 'fake!',
	},
};

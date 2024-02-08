import { myBlueprints } from '#root/project/zemn.me/app/experiments/factorio/blueprint/book/myBlueprints.js';
import { DisplayBlueprintWrapper } from '#root/ts/factorio/react/blueprint.js';

export default function Page() {
	return <DisplayBlueprintWrapper wrapper={myBlueprints} />;
}

import { myBlueprints } from '#root/project/zemn.me/app/experiments/factorio/blueprint/book/myBlueprints';
import { DisplayBlueprintWrapper } from '#root/ts/factorio/react/blueprint';

export default function Page() {
	return <DisplayBlueprintWrapper wrapper={myBlueprints} />;
}

import { DisplayBlueprintWrapper } from "#root/project/zemn.me/app/experiments/factorio/blueprint/blueprint.js";
import { myBlueprints } from '#root/project/zemn.me/app/experiments/factorio/blueprint/book/myBlueprints.js'



export default function Page() {
	return <DisplayBlueprintWrapper wrapper={myBlueprints}/>
}

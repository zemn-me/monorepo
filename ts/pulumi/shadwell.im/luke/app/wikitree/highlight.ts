import type { EntityNode, HighlightFilterId } from '#root/ts/pulumi/shadwell.im/luke/app/wikitree/types.js';

export function matchesHighlightFilter(
	node: Pick<EntityNode, 'highlightFlags'>,
	filterId: HighlightFilterId
) {
	switch (filterId) {
		case 'anglicanPriest':
			return node.highlightFlags.anglicanPriest;
		case 'anyNobleTitle':
			return node.highlightFlags.anyNobleTitle;
		case 'living':
			return node.highlightFlags.living;
		case 'politician':
			return node.highlightFlags.politician;
		case 'military':
			return node.highlightFlags.military;
		case 'monarchNobleTitle':
			return node.highlightFlags.monarchNobleTitle;
		case 'rightHonourable':
			return node.highlightFlags.rightHonourable;
		case 'none':
		default:
			return false;
	}
}

export function normaliseSearchQuery(value: string) {
	return value.trim().toLowerCase();
}

export function matchesSearchQuery(node: Pick<EntityNode, 'id' | 'label'>, searchQuery: string) {
	const normalizedQuery = normaliseSearchQuery(searchQuery);
	if (!normalizedQuery) {
		return false;
	}
	return (
		node.label.toLowerCase().includes(normalizedQuery) ||
		node.id.toLowerCase().includes(normalizedQuery)
	);
}

export function isNodeHighlighted(
	node: Pick<EntityNode, 'highlightFlags' | 'id' | 'label'>,
	filterId: HighlightFilterId,
	searchQuery: string
) {
	return matchesHighlightFilter(node, filterId) || matchesSearchQuery(node, searchQuery);
}

import React from 'react'

/**
 * Runs is a react component that performs the operation
 * of taking a set of react children and collating them
 * into sets of 'runs', which are contiguous 'groups'
 * of elements.
 *
 * This allows a continuous list of
 * React component elements to be broken up into
 * larger blocks, such as might be used for styling different
 * kinds of content.
 *
 * The parameter `transform` should return the input element,
 * `el`, wrapped in some container element type. Once this
 * operation is performed on all passed elements, the resultant
 * children are re-iterated through and grouped by their new
 * assigned parent element's type.
 *
 * @param transform a function which wraps a react element `el`
 * in another react element.
 * @param elements a set of react elements.
 */
export const Runs: React.FC<{
	transform(
		el: React.ReactNode,
	): React.ReactElement<React.PropsWithChildren<{}>>
}> = ({ children, transform }) => {
	let runs: React.ReactElement<React.PropsWithChildren<{}>>[] = []
	React.Children.forEach(children, (child) => {
		const n = transform(child)
		const last = runs[runs.length - 1]
		if (last?.type == n.type) {
			if (!n.props.children)
				throw new Error(
					'this edge case is unlikely and i dont care about it',
				)
			console.log('last:', last, 'runs:', runs)
			runs[runs.length - 1] = React.cloneElement(last, {
				...last.props,
				children: [
					...React.Children.toArray(last.props.children),
					...React.Children.toArray(n.props.children),
				],
			})

			return
		}

		runs.push(n)
	})

	return (
		<>
			{runs.map((el, i) => (
				<React.Fragment key={i}>{el}</React.Fragment>
			))}
		</>
	)
}

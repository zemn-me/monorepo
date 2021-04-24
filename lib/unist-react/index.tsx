import * as unified from 'unified'
import * as unist from 'unist'
import * as hast from 'hast'
import React from 'react'

/**
 * @fileoverview unist-react is less of a library and more of a system for integrating
 * 'unified' ecosystem processors into a pipeline with react, and especially next.js.
 *
 * It defines a methodology for turning unified ecosystem node trees into react component
 * trees. This works especially well with next.js's `getStaticProps`, which allows
 * pre-processing of arbitrary data into JSON-serializable props to be passed at runtime.
 *
 * The unified ecosystem trees are defined to be JSON-serializable, so they're a great fit.
 */

function isReactElement(nd: Node): nd is React.ReactElement {
	return !(
		typeof nd == 'object' &&
		nd !== null &&
		'type' in nd &&
		typeof nd.type == 'string'
	)
}

function isHastElement(nd: Node): nd is hast.Element {
	return nd.type == 'element'
}

export interface Parent extends Omit<unist.Parent, 'children'> {
	type: unist.Parent['type']
	children: unist.Parent['children']
}

export interface ReactNode<
	P = any,
	T extends string | React.JSXElementConstructor<any> =
		| string
		| React.JSXElementConstructor<any>
> extends unist.Literal {
	type: 'react'
	children: undefined
	value: React.ReactElement<P, T>
}

export type ChildlessNode = unist.Node & { children: undefined }

export type Node = UnifiedNode | React.ReactElement
export type UnifiedNode = ChildlessNode | Parent | ReactNode

export type Data = unist.Data
export type Position = unist.Position
export type Point = unist.Point
export type Root = hast.Root

/**
 * The unist-react pipeline is composed of a sequence of
 * 1. Transforms and
 * 2. Bindings
 *
 * which take Context provided node trees and either transform
 * them or render them
 */

const Fallback: React.FC<Node> = (nd) => {
	console.error(`unable to render node of type ${nd.type}`)
	return <p>unable to render node of type {nd.type}</p>
}

const reactElement: React.FC<ReactNode> = (nd) => <>{nd.value}</>

export const RenderParent: React.FC<Parent> = ({ children }) => <>{children}</>

export const bindingType = Symbol()

export interface RegularComponent extends React.FC<any> {
	[bindingType]?: never
}
export interface TreeBindingComponent extends React.FC<any> {
	[bindingType]: 'tree'
}

export type Component = RegularComponent | TreeBindingComponent

export const Elements = React.createContext<
	Record<string, Component> & { fallback?: React.FC<any> }
>({
	react: reactElement,
	root: RenderParent,
})

export interface RenderProps {
	node: Node

	/**
	 * Whether to build the whole tree at once, without having intermediary Render nodes.
	 * This means that virtually the entire tree is pre-emptively calculated, but, conversely
	 * also means that the full rendereed tree is accessible for introspection e.g. by next/Head.
	 *
	 * This will break context support.
	 */
	buildTree?: boolean

	/** to prevent accidental infinite recursion */
	depth?: number
}

const DEPTH_MAX = 99999 as const

export const Render: (props: RenderProps) => React.ReactElement = ({
	node,
	buildTree,
	depth = 0,
}) => {
	if (depth > DEPTH_MAX) throw new Error(`Render depth > ${DEPTH_MAX}`)
	const render = buildTree
		? (node) => Render({ node, buildTree: true })
		: (props: RenderProps) => React.createElement(Render, props)

	const { fallback = Fallback, ...elems } = React.useContext(Elements)

	if (typeof node === 'undefined')
		throw new Error('cannot render undefined tree')
	if (isReactElement(node)) return node

	if (node.type in elems) {
		switch (elems[node.type][bindingType]) {
			case 'tree':
				return React.createElement(elems[node.type], {
					...node,
				})
		}

		return React.createElement(elems[node.type], {
			...node,
			children:
				node?.children?.map((c) =>
					render({ depth: depth + 1, node: c as any }),
				) ?? (node.children as any),
		})
	}

	return React.createElement(fallback, node)
}

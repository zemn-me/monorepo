"use client";
/* eslint-disable @typescript-eslint/ban-types */
// above needed because react uses the type {}, and we need to use it too.
import { createContext, ForwardRefExoticComponent, PropsWithoutRef, ReactNode, RefAttributes, useContext, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A DOM `Element` in which to put table of contents /
 * outline content, or null if none.
 */
const outlinePortalCtx = createContext<Element|null>(null);


export interface OutlineProps<T extends Element> {
	/**
	 * A react component for the DOM element
	 * the outline should be inserted into.
	 */
	readonly element: ForwardRefExoticComponent<
		PropsWithoutRef<{}> & RefAttributes<T>
	>,
	/**
	 * Child elements which inherit this outline.
	 */
	readonly children?: ReactNode
}

/**
 * Outline creates a document outline.
 *
 * * The children of Outline may use
 * `<OutlineSection>` to add branch nodes
 * to the outline tree, or –
 * * <OutlineDescription> to add leaf nodes
 * to the outline tree.
 *
 * The outline element tree is always prepended
 * to `<Outline>`'s children.
 */
export function Outline<T extends Element>(props: OutlineProps<T>) {
	const [tocElement, setTocElement] = useState<T | null>(null);
	return <>
		<props.element ref={setTocElement}/>
		<outlinePortalCtx.Provider value={tocElement}>
			{props.children}
		</outlinePortalCtx.Provider>
	</>
}

export interface OutlineSectionProps<T extends Element> {
	/**
	 * Content to place in the outline for this section.
	 */
	readonly element: ForwardRefExoticComponent<
		PropsWithoutRef<{}> & RefAttributes<T>
	>,
	/**
	 * Contents of this section.
	 */
	readonly children?: ReactNode
}

/**
 * OutlineSection provides a section
 * in the document outline.
 *
 * Any children of the OutlineSection
 * are made children of the corresponding
 * element in the document outline.
 */
export function OutlineSection<T extends Element>(props: OutlineSectionProps<T>) {
	const outlinePortal = useContext(outlinePortalCtx);
	const [newPortal, setNewPortal] = useState<Element | null>(null);

	return <>
		{outlinePortal !== null ?
			createPortal(<props.element ref={setNewPortal} />, outlinePortal)
			: null
		}
		<outlinePortalCtx.Provider value={newPortal}>
			{props.children}
		</outlinePortalCtx.Provider>
	</>
}

export interface OutlineDescriptionProps {
	/**
	 * Contents of this section.
	 */
	readonly children?: ReactNode
}

/**
 * Appends to the document outline.
 *
 * To append a branch node to the document
 * outline, use `OutlineSection`.
 */
export function OutlineDescription(props: OutlineDescriptionProps) {
	const outlinePortal = useContext(outlinePortalCtx);

	return outlinePortal !== null ?
		createPortal(props.children, outlinePortal)
		: null;
}


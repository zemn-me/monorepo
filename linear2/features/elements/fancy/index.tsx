/**
 * @fileoverview this file contains extensions to the basic elements -- the basic elements
 * being generally swap-ins for the standard elements. These have different
 * takes on the basic elements and are therefore fancier.
 */

import * as counters from './counters'
import { PropsOf, classes } from 'linear2/features/elements/util'
import style from './fancy.module.sass'
import React from 'react'

export { counters }
export * from '../headingsAndSections/fancy'
export { style }

export const Li = React.forwardRef<HTMLLIElement, Omit<PropsOf<'li'>, 'ref'>>(
	({ className, children, ...props }, ref) => (
		<li
			{...{
				ref,
				...props,
			}}>
			<span
				{...{
					...classes(style.content),
				}}>
				{children}
			</span>
		</li>
	),
)

export const Ol = React.forwardRef<
	HTMLOListElement,
	Omit<PropsOf<'ol'>, 'ref'>
>(({ className, ...props }, ref) => (
	<ol
		{...{
			...classes(style.fancy, className),
			...props,
			ref,
		}}
	/>
))

export const Ul = React.forwardRef<
	HTMLOListElement,
	Omit<PropsOf<'ul'>, 'ref'>
>(({ className, ...props }, ref) => (
	<ul
		{...{
			...classes(style.fancy, className),
			...props,
			ref,
		}}
	/>
))

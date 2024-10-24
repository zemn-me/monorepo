/* eslint-disable react/forbid-elements */
'use client';
import { useMediaQuery } from "#root/ts/react/useMediaQuery/useMediaQuery.js"

type BaseVideoProps = JSX.IntrinsicElements["video"]

export type VideoProps = BaseVideoProps

export function Video(props: VideoProps) {
	const prefersReducedMotion = useMediaQuery(
		"(prefers-reduced-motion: reduce)"
	);

	const autoPlay = !prefersReducedMotion && props.autoPlay;



	return <video {...{ ...props, autoPlay: autoPlay }}/>
}

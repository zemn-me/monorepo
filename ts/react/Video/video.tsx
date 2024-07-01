/* eslint-disable react/forbid-elements */
'use client';
import { useMediaQuery } from "#root/ts/react/useMediaQuery/useMediaQuery"

type BaseVideoProps = JSX.IntrinsicElements["video"]

export interface VideoProps extends BaseVideoProps {

}

export function Video(props: VideoProps) {
	const prefersReducedMotion = useMediaQuery(
		"(prefers-reduced-motion: reduce)"
	);

	const autoPlay = !prefersReducedMotion && props.autoPlay;



	return <video {...{ ...props, autoPlay: autoPlay }}/>
}

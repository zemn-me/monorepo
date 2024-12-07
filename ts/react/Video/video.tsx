/* eslint-disable react/forbid-elements */
'use client';
import { forwardRef } from "react";

import { useMediaQuery } from "#root/ts/react/useMediaQuery/useMediaQuery.js"

type BaseVideoProps = JSX.IntrinsicElements["video"]

export type VideoProps = BaseVideoProps

export const Video = forwardRef<HTMLVideoElement>(function Video(props: VideoProps, ref) {
	const prefersReducedMotion = useMediaQuery(
		"(prefers-reduced-motion: reduce)"
	);

	const autoPlay = !prefersReducedMotion && props.autoPlay;



	return <video ref={ref} {...{ ...props, autoPlay: autoPlay }}/>
})

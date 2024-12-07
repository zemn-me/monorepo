import classNames from 'classnames';
import { useEffect, useRef, useState } from 'react';

import * as kenwood from '#root/project/zemn.me/assets/kenwood/index.js';
import * as kenwood_snow from '#root/project/zemn.me/assets/kenwood_snow/kenwood_snow.js';
import style from '#root/project/zemn.me/components/HeroVideo/style.module.css';
import { Video } from '#root/ts/react/Video/video.js';
import { getSeason, winter } from '#root/ts/time/season.js';


function first(dates: Date[]): Date {
	if (dates.length === 0) {
		throw new Error();
	}
	return dates.reduce((earliest, current) => current < earliest ? current : earliest);
}


/**
 * Returns {@link Date} for the next time a given month
 * will start.
 */
function nextDateOfMonth(from: Date, month: number): Date {
	return [
		from.getFullYear(),
		from.getFullYear() + 1
	].map(y => new Date(y, month))
		// filter dates in the past.
		.filter(candidate => candidate > from)[0]!;
}

interface Cancel {
	(): void
}

function schedule(fn: () => unknown, at: Date): Cancel {
	const now = new Date();
	if (now > at) throw new Error();
	const hnd = setTimeout(
		fn,
		(+at) - (+now)
	)

	return () => clearTimeout(hnd);
}

const winterStarts = 11;
const winterEnds = 2;



/**
 * In the Northern Hemisphere it is commonly regarded as extending from the winter
 * solstice (year's shortest day), December 21 or 22, to the vernal equinox (day and
 * night equal in length), March 20 or 21, and in the Southern Hemisphere from June
 * 21 or 22 to September 22 or 23.
 */
function isWinter(v: Date, isNorthernHemi?: boolean): boolean {
	return getSeason(v, isNorthernHemi) == winter
}

function useIsWinter() {
	const [bIsWinter, setBIsWinter] = useState<boolean>(
		// calculate initial winter value based
		// on assumption the user is in the northern hemi.
		//
		// this inevitably means the prerender will be
		// wrong for australians.
		isWinter(new Date(), true)
	);

	useEffect(() => {
		// as soon as mounted in a browser, calculate
		// if winter for the local browser.
		setBIsWinter(
			isWinter(new Date())
		)
	}, [ setBIsWinter ]);

	useEffect(() => {
		const now = new Date();
		let cancel;

		function onCheck() {
			setBIsWinter(isWinter(new Date()))

			cancel = schedule(
				onCheck,
				first([nextDateOfMonth(now, winterStarts), nextDateOfMonth(now, winterEnds)])
			)
		}


		onCheck();

		return cancel
	}, [setBIsWinter]);


	return bIsWinter;
}




export interface HeroVideoProps {
	readonly className?: string

}

export function HeroVideo(props: HeroVideoProps) {
	const currentlyWinter = useIsWinter();
	const videoRef = useRef<HTMLVideoElement|null>(null);

	// if winter status changes, reload the video!

	useEffect(
		() => videoRef.current?.load()
	, [currentlyWinter])

	return <Video
		autoPlay
		className={classNames(style.heroVideo, props.className)}
		loop
		muted
		playsInline
		poster={
			(currentlyWinter ? kenwood_snow.poster : kenwood.poster).src
		}
		ref={videoRef}
	>
		{currentlyWinter ? (
			<kenwood_snow.VideoSources />
		) : (
			<kenwood.VideoSources />
		)}
	</Video>

}

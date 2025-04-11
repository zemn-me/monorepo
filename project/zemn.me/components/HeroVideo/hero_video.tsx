import classNames from 'classnames';
import { useCallback, useEffect, useRef, useState } from 'react';

import * as kenwood from '#root/project/zemn.me/assets/kenwood/index.js';
import * as kenwood_snow from '#root/project/zemn.me/assets/kenwood_snow/kenwood_snow.js';
import {
	poster as mistOnTheHillsPoster,
	VideoSources as MistOnTheHillsVideoSources,
} from '#root/project/zemn.me/assets/mist_on_the_hills/mist_on_the_hills.js';
import style from '#root/project/zemn.me/components/HeroVideo/style.module.css';
import { Video } from '#root/ts/react/Video/video.js';
import {
	autumn,
	getSeason,
	type Season,
	spring,
	summer,
	winter,
} from '#root/ts/time/season.js';

/** Returns earliest date from an array. */
function first(dates: Date[]): Date {
	if (!dates.length) {
		throw new Error('No dates provided');
	}
	return dates.reduce(
		(earliest, current) => (current < earliest ? current : earliest),
	);
}

/**
 * Returns the next time a particular month starts,
 * relative to a given date.
 * Returns `undefined` if no suitable date can be found.
 */
function nextDateOfMonth(from: Date, month: number): Date | undefined {
	const possible = [
		new Date(from.getFullYear(), month),
		new Date(from.getFullYear() + 1, month),
	].filter(candidate => candidate > from);

	return possible[0];
}

/**
 * Schedules a function to run at a specific time.
 * Returns a function to cancel it.
 */
type Cancel = () => void;
function schedule(fn: () => void, at: Date): Cancel {
	const now = new Date();
	// If 'at' is not strictly in the future, call the function immediately.
	if (now >= at) {
		fn();
		return () => {
			/* no-op */
		};
	}
	const handle = setTimeout(fn, +at - +now);
	return () => clearTimeout(handle);
}

/**
 * For approximate usage, define the months in which each
 * season typically begins (northern hemisphere).
 */
const SEASON_START_MONTHS = {
	[winter]: 11, // December
	[spring]: 2, // March
	[summer]: 5, // June
	[autumn]: 8, // September
};

/**
 * Provides the current season, auto-updating at relevant boundaries.
 */
export function useSeason(): Season {
	// Provide a fallback for SSR by guessing northern hemisphere initially:
	const [season, setSeason] = useState<Season>(() => getSeason(new Date(), true));

	function scheduleNextCheck() {
		const now = new Date();

		// For each season, compute the next date on which that season is assumed to start.
		const upcomingBoundaries = Object.values<number>(SEASON_START_MONTHS)
			.map(month => nextDateOfMonth(now, month))
			.filter(Boolean) as Date[];

		// If no future boundary is found, do nothing (or schedule a fallback check).
		if (!upcomingBoundaries.length) {
			return;
		}

		// Schedule a check at the earliest boundary.
		return schedule(() => {
			// Recalculate the season:
			setSeason(getSeason(new Date()));
			// Then schedule again for the next set of boundaries.
			scheduleNextCheck();
		}, first(upcomingBoundaries));
	}

	// On mount, re-check the season for the user’s real location (client-side).
	useEffect(() => {
		setSeason(getSeason(new Date()));
	}, []);

	// Schedule repeated checks at season boundaries.
	useEffect(() => {
		const cancel = scheduleNextCheck();
		return cancel;
	}, []);

	return season;
}

/** Convenience hooks returning boolean states for each season. */
export function useIsWinter() {
	return useSeason() === winter;
}
export function useIsSpring() {
	return useSeason() === spring;
}
export function useIsSummer() {
	return useSeason() === summer;
}
export function useIsAutumn() {
	return useSeason() === autumn;
}

/** A sample component that references the new hooks. */
export interface HeroVideoProps {
	readonly className?: string;
}

type LatLng = [latitude: number, longitude: number];

export function HeroVideo(props: HeroVideoProps) {
	const [captionToggled, setCaptionToggled ] = useState(false)
	const season = useSeason();
	const videoRef = useRef<HTMLVideoElement | null>(null);

	type VideoChoice = [
		posterSrc: string,
		videoSources: JSX.Element,
		caption?: string,
		latLng?: LatLng
	]

	const kenwoodSummerVideoSource: VideoChoice = [
		kenwood.poster.src,
		<kenwood.VideoSources key="summer-sources" />,
		"Kenwood House Gardens",
		[51.57139601074658, -0.16924392259112794]
	] as const;

	const kenwoodWinterVideoSource = [
		kenwood_snow.poster.src,
		<kenwood_snow.VideoSources key="winter-sources" />,
		"Kenwood House",
		[51.57122281677411, -0.16746393741998228]
	] as const;

	const mistOnTheHillsVideoSource = [
		mistOnTheHillsPoster.src,
		<MistOnTheHillsVideoSources key="mist-sources" />,
		"East Devon AONB",
	] as const;

	const [videoPoster, videoSource, caption, latlng] = {
		[winter]: kenwoodWinterVideoSource,
		// Technically incorrect, as it was filmed in December...
		// i actually don't like this as much as I thought in practice
		// but keeping here for now because i do want *something* for
		//spring
		[spring]: mistOnTheHillsVideoSource,
		[summer]: kenwoodSummerVideoSource,
		[autumn]: kenwoodSummerVideoSource,
	}[season];

	const [lat, lng] = latlng ?? [];

	useEffect(() => {
		videoRef.current?.load();
	}, [season]);

	const onClick = useCallback(
		() => setCaptionToggled(v => !v)
	, [ setCaptionToggled ] );


	return (
		<figure className={classNames(
			style.heroVideo,
			props.className
		)}
			onClick={onClick}
		>
			<Video
				autoPlay
				className={classNames(style.cover)}
				loop
				muted
				playsInline
				poster={videoPoster}
				ref={videoRef}
			>
				{videoSource}
			</Video>

			<figcaption className={
				classNames(
					captionToggled ? style.toggled : undefined,
					style.caption
				)
			}
			>
				{caption} {lat}°N {lng}°E
			</figcaption>
		</figure>
	);
}

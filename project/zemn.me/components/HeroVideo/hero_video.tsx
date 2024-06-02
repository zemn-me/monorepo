import classNames from 'classnames';

import * as kenwood from '#root/project/zemn.me/assets/kenwood/index.js';
import * as kenwood_snow from '#root/project/zemn.me/assets/kenwood_snow/kenwood_snow.js';
import style from '#root/project/zemn.me/components/HeroVideo/style.module.css';


/**
 * In the Northern Hemisphere it is commonly regarded as extending from the winter
 * solstice (year's shortest day), December 21 or 22, to the vernal equinox (day and
 * night equal in length), March 20 or 21, and in the Southern Hemisphere from June
 * 21 or 22 to September 22 or 23.
 */
function isWinter(v: Date): boolean {
	const month = v.getMonth();
	return month >= 11 || month <= 1;
}

export interface HeroVideoProps {
	readonly className?: string

}

export function HeroVideo(props: HeroVideoProps) {

	const currentlyWinter = isWinter(new Date());

	return 			<video
				autoPlay
				className={classNames(style.heroVideo, props.className)}
				loop
				muted
				playsInline
				poster={
					(currentlyWinter ? kenwood_snow.poster : kenwood.poster).src
				}
			>
				{currentlyWinter ? (
					<kenwood_snow.VideoSources />
				) : (
					<kenwood.VideoSources />
				)}
			</video>

}

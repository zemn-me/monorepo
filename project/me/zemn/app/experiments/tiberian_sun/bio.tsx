import { useCallback, useMemo, useState } from 'react';
import {
	bioMissions,
	createBioCampaign,
} from '#root/project/me/zemn/app/experiments/tiberian_sun/campaign.js';
import style from '#root/project/me/zemn/app/experiments/tiberian_sun/campaign.module.css';
import { TiberianSun } from '#root/project/me/zemn/app/experiments/tiberian_sun/client.js';
import { assets } from '#root/project/me/zemn/app/experiments/tiberian_sun/page.js';
import Link from '#root/project/me/zemn/components/Link/index.js';
import { text } from '#root/ts/react/lang/index.js';
import type { Metadata } from '#root/ts/remix/metadata.js';

export default function BioCampaign() {
	const [selected, select] = useState(0);
	const [deployed, deploy] = useState(false);
	const returnToDossier = useCallback(() => deploy(false), []);
	const missions = useMemo(() => bioMissions(), []);
	const campaign = useMemo(
		() => createBioCampaign(missions, selected),
		[missions, selected]
	);
	const mission = missions[selected];
	if (deployed)
		return (
			<TiberianSun
				assets={assets}
				campaign={campaign}
				onExit={returnToDossier}
			/>
		);
	return (
		<main className={style.command}>
			<header className={style.header}>
				<Link href="/">← zemn.me</Link>
				<span>PERSONNEL ARCHIVE / TS–01</span>
				<Link href="/experiments/tiberian-sun">Original game ↗</Link>
			</header>
			<div className={style.intro}>
				<p className={style.eyebrow}>TIBERIAN SUN · CUSTOM CAMPAIGN</p>
				<h1>
					A life in
					<br />
					<em>the field.</em>
				</h1>
				<p>
					Thomas Shadwell’s bio, recovered one transmission at a time.
				</p>
			</div>
			<div className={style.operations}>
				<nav aria-label="Campaign missions" className={style.missions}>
					<p className={style.eyebrow}>SELECT AN OPERATION</p>
					{missions.map((item, index) => (
						<button
							type="button"
							key={item.scenario}
							aria-pressed={selected === index}
							onClick={() => select(index)}
						>
							<span className={style.number}>0{index + 1}</span>
							<span>
								<small>{item.years}</small>
								<strong>{item.title}</strong>
							</span>
							<span aria-hidden="true">↗</span>
						</button>
					))}
				</nav>
				<section
					className={style.briefing}
					aria-label="Mission briefing"
				>
					<div className={style.radar} aria-hidden="true">
						<svg viewBox="0 0 400 240">
							<path
								d="M200 15 380 120 200 225 20 120Z M65 94 245 199 M110 68 290 173 M155 41 335 146 M65 146 245 41 M110 173 290 68 M155 199 335 94"
								fill="none"
								stroke="currentColor"
								opacity=".25"
							/>
							<path
								d="m110 120 90-53 90 80-90 26Z"
								fill="none"
								stroke="currentColor"
								strokeDasharray="4 5"
							/>
							{(
								[
									[110, 120],
									[200, 67],
									[290, 147],
								] as const
							).map(([x, y], i) => (
								<g key={x}>
									<circle
										cx={x}
										cy={y}
										r="14"
										fill="#b6d66a"
										fillOpacity=".12"
										stroke="currentColor"
									/>
									<circle
										cx={x}
										cy={y}
										r="3"
										fill="currentColor"
									/>
									<text
										x={x + 20}
										y={y + 4}
										fill="currentColor"
										fontSize="11"
									>
										0{i + 1}
									</text>
								</g>
							))}
							<text
								x="15"
								y="225"
								fill="currentColor"
								fontSize="10"
							>
								3 UPLINKS / RECONNAISSANCE
							</text>
						</svg>
					</div>
					<p className={style.eyebrow}>
						OPERATION 0{selected + 1} / {mission?.years}
					</p>
					<h2>{mission?.title}</h2>
					<p>{mission?.briefing}</p>
					<p>
						Command a small GDI expedition. Explore the shroud and
						approach three archive huts marked on the radar to
						receive transmissions from the timeline. Recover all
						three to advance to the next era.
					</p>
					<button
						type="button"
						className={style.deploy}
						onClick={() => deploy(true)}
					>
						Deploy expedition <span aria-hidden="true">→</span>
					</button>
					<p className={style.hint}>
						Keyboard + mouse · Peaceful exploration · Four linked
						missions
						<br />
						First launch downloads about 88 MiB. Saves stay in this
						browser.
					</p>
				</section>
			</div>
			<section className={style.dossier} aria-label="Mission dossier">
				<div className={style.dossierHeading}>
					<h2>The dossier</h2>
					<span>
						{mission?.events.length} RECORDS / {mission?.years}
					</span>
				</div>
				<p>
					The real timeline behind this operation. The campaign’s
					setting is fictional; these records come directly from my
					bio.
				</p>
				<ol>
					{mission?.events.map(event => (
						<li key={event.id}>
							<time
								dateTime={event.date.toISOString().slice(0, 10)}
							>
								{event.date.toISOString().slice(0, 10)}
							</time>
							<div>
								<h3>
									{event.url ? (
										<Link href={event.url.toString()}>
											{text(event.title)} ↗
										</Link>
									) : (
										text(event.title)
									)}
								</h3>
								{event.description && (
									<p>{text(event.description)}</p>
								)}
							</div>
						</li>
					))}
				</ol>
			</section>
			<footer className={style.footer}>
				Built with the Tiberian Sun browser port. EA has not endorsed
				and does not support this product.{' '}
				<Link href="/experiments/tiberian-sun">
					Game &amp; licenses
				</Link>
			</footer>
		</main>
	);
}
export const metadata: Metadata = {
	title: 'A life in the field | Bio campaign',
	description:
		'Explore Thomas Shadwell’s bio in a custom Tiberian Sun campaign.',
};
export const handle = { metadata };

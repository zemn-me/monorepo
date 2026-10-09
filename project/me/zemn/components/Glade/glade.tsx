'use client';
import { ReactNode, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { animated, useReducedMotion, useSpring } from 'react-spring';

import * as bio from '#root/project/me/zemn/bio/index.js';
import { dividerHeadingClass } from '#root/project/me/zemn/components/DividerHeading/index.js';
import { HeraldicShield } from '#root/project/me/zemn/components/Glade/heraldic_shield.js';
import { GladeMenu } from '#root/project/me/zemn/components/Glade/menu.js';
import style from '#root/project/me/zemn/components/Glade/style.module.css';
import { HeroVideo } from '#root/project/me/zemn/components/HeroVideo/hero_video.js';
import { InlineLogin } from '#root/project/me/zemn/components/InlineLogin/inline_login.js';
import Link from '#root/project/me/zemn/components/Link/index.js';
import { TimeEye } from '#root/project/me/zemn/components/TimeEye/index.js';
import { Rays } from '#root/project/me/zemn/components/TimeEye/rays.js';
import ZemnmezLogo from '#root/project/me/zemn/components/ZemnmezLogo/ZemnmezLogo.js';
import { repoFirstCommitYear } from '#root/ts/constants/constants.js';
import * as lang from '#root/ts/react/lang/index.js';

function FooterEmblem() {
	const [isAnniversary, setIsAnniversary] = useState(false);

	useEffect(() => {
		// Resolve the visitor's local date after hydration, not at static build time.
		const update = () => {
			const today = new Date();
			// The zemnmez name began on 3 February 2009.
			setIsAnniversary(today.getMonth() === 1 && today.getDate() === 3);
		};
		update();
		const timer = window.setInterval(update, 60_000);
		return () => window.clearInterval(timer);
	}, []);

	return isAnniversary ? (
		<ZemnmezLogo className={style.footerEmblem} />
	) : (
		<HeraldicShield className={style.footerEmblem} />
	);
}

/**
 * LetterHead is the inner part of the heading with the name and logo.
 */
function LetterHead({ compact = false }: { readonly compact?: boolean }) {
	return (
		<Link
			aria-label="Go to homepage"
			className={compact ? style.compactLetterHead : style.letterHead}
			href="/"
			styleless
		>
			{!compact && (
				<div className={style.handle}>
					{lang.text(bio.Bio.who.handle)}
				</div>
			)}
			<TimeEye className={style.logo} />
			{!compact && (
				<div className={style.fullName}>Thomas NJ Shadwell</div>
			)}
		</Link>
	);
}

const AnimatedRays = animated(Rays);

function NavigationRays({ loading }: { readonly loading: boolean }) {
	const reducedMotion = useReducedMotion();
	const { length } = useSpring({
		length: loading ? 145 : 0,
		config: { tension: 600, friction: 30, clamp: true },
		immediate: !!reducedMotion,
	});
	return (
		<span
			className={`${style.logoLoading} ${loading ? style.active : ''}`}
			role={loading ? 'status' : undefined}
			aria-hidden={!loading}
			aria-label="Loading page"
			title="Loading page"
		>
			<svg
				className={style.logoRays}
				viewBox="-120 -80 240 160"
				aria-hidden="true"
			>
				<g>
					<AnimatedRays
						nRays={80}
						length={length}
						innerSpacePerc={25}
						innerSpaceVariationPerc={60}
						randomAmountPerc={30}
						maxSegments={8}
						minSegments={2}
						strokeWidth={0.65}
						transform="scale(1 0.6)"
					/>
				</g>
			</svg>
		</span>
	);
}

export interface GladeProps {
	readonly children?: ReactNode;
	readonly navigationPending?: boolean;
	readonly navigationFailed?: boolean;
	readonly retryNavigation?: () => void;
}

export default function Glade(props: GladeProps) {
	const pathname = useLocation().pathname;
	const isHomepage = pathname == '/';
	const navigate = useNavigate();
	const [canGoBack, setCanGoBack] = useState(false);
	useEffect(() => {
		const navigation = window.navigation;
		const update = () => setCanGoBack(navigation?.canGoBack ?? false);
		update();
		navigation?.addEventListener('currententrychange', update);
		return () =>
			navigation?.removeEventListener('currententrychange', update);
	}, []);
	const [showNavigationStatus, setShowNavigationStatus] = useState(false);
	useEffect(() => {
		setShowNavigationStatus(false);
		if (!props.navigationPending) return;
		// Avoid flashing feedback for navigations that complete quickly.
		const timer = window.setTimeout(
			() => setShowNavigationStatus(true),
			200
		);
		return () => window.clearTimeout(timer);
	}, [props.navigationPending]);

	const loading = !!props.navigationPending && showNavigationStatus;
	return (
		<main
			className={`${style.main} ${isHomepage ? '' : style.compact}`}
			data-glade-layout
		>
			<section className={style.content} data-glade-content>
				{props.navigationFailed && (
					<div className={style.navigationFailure} role="alert">
						<span>
							Could not load the page. Check your connection.
						</span>
						<button type="button" onClick={props.retryNavigation}>
							Try again
						</button>
					</div>
				)}
				{props.children}
			</section>
			<HeroVideo className={style.headerBgv} data-glade-banner />
			{isHomepage && (
				<div className={style.banner} data-glade-banner>
					<LetterHead />
				</div>
			)}
			<header
				className={`${style.topbar} ${isHomepage ? style.homeTopbar : ''}`}
				data-glade-banner
			>
				<div className={style.backSlot}>
					{canGoBack && (
						<button
							type="button"
							className={style.backButton}
							aria-label="Go back"
							title="Go back"
							onClick={() => void navigate(-1)}
						>
							<span aria-hidden="true">←</span>
						</button>
					)}
				</div>
				{isHomepage ? (
					loading ? (
						<span
							className={style.navigationStatus}
							role="status"
							aria-label="Loading page"
						>
							Loading…
						</span>
					) : (
						<span />
					)
				) : (
					<LetterHead compact />
				)}
				<GladeMenu />
				{!isHomepage && <NavigationRays loading={loading} />}
			</header>
			<section className={style.footer} data-glade-footer>
				<h2 className={dividerHeadingClass}>
					<span>⁂</span>
				</h2>
				<FooterEmblem />
				{isHomepage ? (
					<i className={style.tagline}>
						This is what we become, when our eyes are open.
					</i>
				) : null}
				{/* The <small> HTML element represents side-comments and
					small print, like copyright and legal text, independent of
					its styled presentation. By default, it renders text within
					it one font-size smaller, such as from small to x-small.
					*/}
				<small
					className={style.copyright}
					lang={bio.Bio.who.fullName.language}
				>
					© TNJS <br /> {repoFirstCommitYear} —{' '}
					{new Date().getFullYear()} <br />
					<InlineLogin />
				</small>
			</section>
		</main>
	);
}

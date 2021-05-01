import { Timeline, makeYears } from 'linear2/features/elements/timeline'
import Eye from '@zemn.me/art/time'
import { Bio } from '@zemn.me/bio'
import * as e from 'linear2/features/elements'
//import Video from '@zemn.me/video';
import React from 'react'
import style from './home.module.css'
import * as bio from 'lib/bio'
import { a as Link } from 'modules/elements'
import * as Url from 'modules/url'

interface HomeProps {
	filter?: (event: bio.Event) => boolean
}

const Home: (props: HomeProps) => React.ReactElement = ({ filter }) => {
	const years = makeYears(bio.timeline)

	const content = (
		<div className={style.home}>
			<e.WithText text={Bio.who.handle}>
				<div className={style.header}>
					<e.Text />
				</div>
			</e.WithText>

			<div className={style.links}>
				{Bio.links.map(([label, link], i) => (
					<e.WithText text={label}>
						<Link href={new Url.URL(link.toString())}>
							<e.Text />
						</Link>
					</e.WithText>
				))}
			</div>

			{/*<div className={style.navBar}>
            <div className={style.eyeContainer}>
                <Eye className={style.eye}/>
            </div>
            </div>*/}

			<e.WithText text={Bio.who.name}>
				<div className={style.name}>
					<e.Text />
				</div>
			</e.WithText>

			<Timeline
				{...{
					years,
					lang: 'en-GB',
					className: style.timeline,
				}}
			/>
		</div>
	)
	return content
}

export default Home

"use client";
import { useCallback, useState } from "react";

import { Article } from "#root/project/zemn.me/components/Article/article.js";
import { H1, H2, H3 } from "#root/project/zemn.me/components/Article/heading.js";
import { Section } from "#root/project/zemn.me/components/Article/section.js";


function TogglableSection() {
	const [sectionVisible, setSectionVisible] = useState<boolean>(true);
	const onButtonClick = useCallback(() => {
		setSectionVisible(previous => !previous);
	}, [setSectionVisible] )
	return <Section>
		<H2>Togglable Section</H2>
		<p>
			This section contains a section which you can
			<button onClick={onButtonClick}>click</button> to remove.
		</p>
		<p>
			Thanks to portals, when it is removed, it will also be
			removed from the table of contents!
		</p>
		{sectionVisible ? <Section>
			<H3>The Section in Question</H3>
			<p>
				Click the button in the parent section to remove me!
			</p>
		</Section> : null}
	</Section>
}

export default function Page() {
	return <Article>
		<Section>
			<H1>Test of table of contents rendering</H1>
			<p>This article layout should generate a nice table of contents! using portals!</p>

			<Section>
				<H2>How it Works</H2>
				<p>Every Section gets its own portal, and every section header adds an element to that portal.</p>
			</Section>

			<Section>
				<H2>Can I use it?</H2>
				<p>Maybe.</p>
			</Section>

			<Section>
				<H2>Does it work with MDX?</H2>
				<p>Probably.</p>

				<Section>
					<H3>What if I ask nicely?</H3>
					<p>Give it a shot!</p>
				</Section>
			</Section>

			<TogglableSection/>
		</Section>
	</Article>
}

import { Section, Header, P } from '@zemn.me/linear/elements'

const L = () => (
	<Section id="sup">
		<Header>Top Level Header!</Header>
		<P>Some words!</P>

		<Section id="2">
			<Header>Automatically slightly less top level header!</Header>
			<P>Some more words!</P>
		</Section>
	</Section>
)

export default L

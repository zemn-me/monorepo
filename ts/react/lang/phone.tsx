import libphonenumber from 'google-libphonenumber'

interface NumberProps {
	number: string
}

const pnUtil = new libphonenumber.PhoneNumberUtil();

export function Number(props: NumberProps) {
	const pn = pnUtil.parseAndKeepRawInput(props.number);

	return <>{pnUtil.format(pn, libphonenumber.PhoneNumberFormat.INTERNATIONAL)}</>
}

import React from 'react'
import { useRouter } from 'next/router'

export interface ErrorProps {
	code?: number | string
}

const E: (props: ErrorProps) => React.ReactElement = ({ code: queryCode }) => {
	const router = useRouter()
	const code = queryCode ?? router.query.code
	if (!code) return <E code="404" />

	if (code instanceof Array) return <E code="500" />

	return <>{code}</>
}

export default E

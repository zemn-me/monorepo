import {
	faCircleExclamation,
	faCloudArrowUp,
	faPause,
	faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import style from '#root/project/me/zemn/app/journal/style.module.css';

export function JournalStatus({
	label,
	state = 'busy',
}: {
	readonly label: string;
	readonly state?: 'busy' | 'queued' | 'interrupted' | 'error';
}) {
	const icon = {
		busy: faSpinner,
		queued: faCloudArrowUp,
		interrupted: faPause,
		error: faCircleExclamation,
	}[state];
	return (
		<span
			aria-label={label}
			className={style.statusIndicator}
			data-state={state}
			role="status"
			title={label}
		>
			<FontAwesomeIcon aria-hidden="true" icon={icon} />
			<span className={style.visuallyHidden}>{label}</span>
		</span>
	);
}

export function JournalPlaceholder({ label }: { readonly label: string }) {
	return (
		<div aria-label={label} className={style.placeholder} role="status">
			<span className={style.visuallyHidden}>{label}</span>
			<span aria-hidden="true" />
			<span aria-hidden="true" />
			<span aria-hidden="true" />
		</div>
	);
}

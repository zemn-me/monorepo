import { SignalID } from '#root/ts/factorio/signal_id.js';

export interface SpeakerAlertParameter {
	show_alert: boolean;
	show_on_map: boolean;
	icon_signal_id: SignalID;
	alert_message: string;
}

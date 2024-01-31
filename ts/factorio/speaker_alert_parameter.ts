import { SignalID } from '#root/ts/factorio/signal_id.js';
import { JSONObject } from '#root/ts/json.js';

export interface SpeakerAlertParameter extends JSONObject {
	show_alert: boolean;
	show_on_map: boolean;
	icon_signal_id: SignalID;
	alert_message: string;
}

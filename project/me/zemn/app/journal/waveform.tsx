import { useEffect, useRef, useState } from 'react';
import style from '#root/project/me/zemn/app/journal/style.module.css';

function clock(seconds: number) {
	const time = Math.max(0, Math.floor(seconds));
	const minutes = Math.floor(time / 60);
	return `${minutes}:${String(time % 60).padStart(2, '0')}`;
}

// Decode at speech bandwidth to keep the overview small even for long notes.
// Each bin retains the loudest sample from any channel.
async function readPeaks(source: string, signal: AbortSignal) {
	const response = await fetch(source, { signal, credentials: 'omit' });
	if (!response.ok) throw new Error('Waveform unavailable');
	const bytes = await response.arrayBuffer();
	signal.throwIfAborted();
	const buffer = await new OfflineAudioContext(1, 1, 8000).decodeAudioData(
		bytes
	);
	signal.throwIfAborted();
	const peaks = new Float32Array(192);
	for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
		const samples = buffer.getChannelData(channel);
		const width = samples.length / peaks.length;
		for (let bin = 0; bin < peaks.length; bin++) {
			let peak = peaks[bin] ?? 0;
			const end = Math.floor((bin + 1) * width);
			for (let i = Math.floor(bin * width); i < end; i++) {
				peak = Math.max(peak, Math.abs(samples[i] ?? 0));
			}
			peaks[bin] = peak;
		}
	}
	return peaks;
}

export function Waveform({
	audio,
	source,
	durationMs,
	onSeek,
}: {
	readonly audio: HTMLAudioElement;
	readonly source: string;
	readonly durationMs?: number;
	readonly onSeek: (seconds: number) => void;
}) {
	const [peaks, setPeaks] = useState<Float32Array>();
	const [position, setPosition] = useState(audio.currentTime);
	const [duration, setDuration] = useState(0);
	const canvas = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		if (peaks) return;
		const controller = new AbortController();
		void readPeaks(source, controller.signal)
			.then(setPeaks)
			.catch(() => {
				// The time slider stays usable for media the browser cannot decode.
			});
		return () => controller.abort();
	}, [peaks, source]);

	useEffect(() => {
		const update = () => {
			setPosition(audio.currentTime);
			setDuration(
				Number.isFinite(audio.duration)
					? audio.duration
					: (durationMs ?? 0) / 1000
			);
		};
		update();
		const events = [
			'durationchange',
			'timeupdate',
			'seeking',
			'loadedmetadata',
		];
		for (const name of events) audio.addEventListener(name, update);
		return () => {
			for (const name of events) audio.removeEventListener(name, update);
		};
	}, [audio, durationMs]);
	useEffect(() => {
		const surface = canvas.current;
		if (!surface) return;
		const draw = () => {
			const w = surface.clientWidth;
			const h = surface.clientHeight;
			const scale = window.devicePixelRatio;
			surface.width = Math.round(w * scale);
			surface.height = Math.round(h * scale);
			const ctx = surface.getContext('2d');
			if (!ctx) return;
			ctx.scale(scale, scale);
			ctx.fillStyle = getComputedStyle(surface).color;
			ctx.globalAlpha = 0.4;
			ctx.fillRect(0, h / 2, w, 1);
			if (!peaks) return;
			const count = Math.min(
				peaks.length,
				Math.max(1, Math.floor(w / 4))
			);
			const maximum = Math.max(0.001, ...peaks);
			for (let i = 0; i < count; i++) {
				const values = peaks.subarray(
					Math.floor((i * peaks.length) / count),
					Math.floor(((i + 1) * peaks.length) / count)
				);
				const bar = Math.max(
					1,
					Math.sqrt(Math.max(...values) / maximum) * (h - 4)
				);
				ctx.globalAlpha = i / count <= position / duration ? 1 : 0.52;
				ctx.fillRect(
					(i * w) / count,
					(h - bar) / 2,
					Math.max(1, w / count - 2),
					bar
				);
			}
		};
		draw();
		const observer = new ResizeObserver(draw);
		observer.observe(surface);
		return () => observer.disconnect();
	}, [duration, peaks, position]);
	return (
		<div className={style.waveSeek}>
			<div className={style.waveTrack}>
				<canvas aria-hidden="true" ref={canvas} />
				<input
					aria-label="Seek recording"
					aria-valuetext={clock(position) + ' of ' + clock(duration)}
					type="range"
					min={0}
					max={duration || 0}
					step={0.1}
					disabled={!duration}
					value={Math.min(position, duration)}
					onChange={event => {
						const seconds = event.currentTarget.valueAsNumber;
						setPosition(seconds);
						onSeek(seconds);
					}}
				/>
			</div>
			<div className={style.playerTimes} aria-hidden="true">
				<span>{clock(position)}</span>
				<span>{clock(duration)}</span>
			</div>
		</div>
	);
}

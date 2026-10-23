// Native nodes retain their graph and buffer APIs; only audio consumption and
// completion are driven by the test clock, without a physical audio device.
export function installClockedAudio(): void {
	const NativeAudioContext = globalThis.AudioContext;
	class ClockedAudioContext extends NativeAudioContext {
		#state: AudioContextState = 'suspended';
		#elapsed = 0;
		#started = 0;
		#processors = new Set<() => void>();
		#sources = new Set<() => void>();
		constructor(options?: AudioContextOptions) {
			super(options);
			// A context created during a trusted gesture can already be running.
			// Preserve that autoplay decision, then drive elapsed time virtually.
			this.#state = super.state;
			this.#started = performance.now();
		}

		override get state(): AudioContextState {
			return this.#state;
		}
		override get currentTime(): number {
			return (
				(this.#elapsed +
					(this.#state === 'running'
						? performance.now() - this.#started
						: 0)) /
				1000
			);
		}
		override resume(): Promise<void> {
			if (this.#state === 'suspended') {
				this.#started = performance.now();
				this.#state = 'running';
				for (const schedule of this.#sources) schedule();
			}
			return Promise.resolve();
		}
		override suspend(): Promise<void> {
			if (this.#state === 'running') {
				this.#elapsed += performance.now() - this.#started;
				this.#state = 'suspended';
				for (const schedule of this.#sources) schedule();
			}
			return Promise.resolve();
		}
		override close(): Promise<void> {
			void this.suspend();
			this.#state = 'closed';
			for (const disconnect of this.#processors) disconnect();
			this.#sources.clear();
			return super.close();
		}
		override createBufferSource(): AudioBufferSourceNode {
			const source = super.createBufferSource();
			let started = false,
				ended = false,
				end = Infinity,
				stop = Infinity;
			let timer: ReturnType<typeof setTimeout> | undefined;
			const schedule = () => {
				clearTimeout(timer);
				if (!started || ended || this.state !== 'running') return;
				const deadline = Math.min(end, stop);
				if (!Number.isFinite(deadline)) return;
				timer = setTimeout(
					() => {
						ended = true;
						this.#sources.delete(schedule);
						source.dispatchEvent(new Event('ended'));
					},
					Math.max(0, Math.ceil((deadline - this.currentTime) * 1000))
				);
			};
			source.start = (when = 0, offset = 0, duration?: number) => {
				if (started)
					throw new DOMException(
						'Source already started',
						'InvalidStateError'
					);
				started = true;
				const remaining =
					duration ??
					Math.max(0, (source.buffer?.duration ?? 0) - offset);
				end = source.loop
					? Infinity
					: Math.max(when, this.currentTime) +
						remaining / source.playbackRate.value;
				this.#sources.add(schedule);
				schedule();
			};
			source.stop = (when = 0) => {
				if (!started)
					throw new DOMException(
						'Source has not started',
						'InvalidStateError'
					);
				stop = when;
				schedule();
			};
			return source;
		}
		override createScriptProcessor(
			frames = 4096,
			inputs = 2,
			outputs = 2
		): ScriptProcessorNode {
			const inputBuffer = this.createBuffer(
				Math.max(inputs, 1),
				frames,
				this.sampleRate
			);
			const outputBuffer = this.createBuffer(
				Math.max(outputs, 1),
				frames,
				this.sampleRate
			);
			const period = (frames / this.sampleRate) * 1000;
			let timer: ReturnType<typeof setTimeout> | undefined;
			let connected = false,
				deadline = 0;
			const disconnect = () => {
				connected = false;
				clearTimeout(timer);
				this.#processors.delete(disconnect);
			};
			const process = () => {
				if (!connected) return;
				if (this.state === 'running')
					node.onaudioprocess?.({
						inputBuffer,
						outputBuffer,
						playbackTime: this.currentTime,
					});
				if (!connected) return;
				deadline += period;
				timer = setTimeout(
					process,
					Math.max(1, Math.ceil(deadline - performance.now()))
				);
			};
			const node = {
				onaudioprocess: null as
					| ((
							event: Pick<
								AudioProcessingEvent,
								'inputBuffer' | 'outputBuffer' | 'playbackTime'
							>
					  ) => void)
					| null,
				connect: (destination: AudioNode) => {
					if (!connected) {
						connected = true;
						deadline = performance.now() + period;
						timer = setTimeout(process, Math.ceil(period));
						this.#processors.add(disconnect);
					}
					return destination;
				},
				disconnect,
			};
			return node as unknown as ScriptProcessorNode;
		}
	}
	globalThis.AudioContext = ClockedAudioContext;
}

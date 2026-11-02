import { restorePerformanceEntries } from '#root/go/seleniumutil/native_performance.js';
import '#root/go/seleniumutil/virtual_clock.mjs';
import { installClockedAudio } from '#root/go/seleniumutil/clocked_audio.js';

// Preserve network observations while advancing simulation and audio virtually.
restorePerformanceEntries();
installClockedAudio();

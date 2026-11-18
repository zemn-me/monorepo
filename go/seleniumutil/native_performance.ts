// Capture before fake timers replace performance. Network work still happens
// in the browser, so its observable resource entries must remain available.
const nativePerformance = globalThis.performance;

export function restorePerformanceEntries(): void {
	performance.getEntries =
		nativePerformance.getEntries.bind(nativePerformance);
	performance.getEntriesByName =
		nativePerformance.getEntriesByName.bind(nativePerformance);
	performance.getEntriesByType =
		nativePerformance.getEntriesByType.bind(nativePerformance);
	performance.clearResourceTimings =
		nativePerformance.clearResourceTimings.bind(nativePerformance);
}

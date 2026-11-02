/* biome-ignore-all lint/suspicious/noConsole: this file intentionally writes to the console */
class BazelReporter {
	onRunComplete(
		_: unknown,
		results: { numFailedTests?: number; snapshot: { failure: boolean } }
	) {
		if (results.numFailedTests && results.snapshot.failure) {
			console.log(`================================================================================

      Snapshot failed, you can update the snapshot by running
      bazel run ${process.env['TEST_TARGET']!.replace(/_bin$/, '')}.update
      `);
		}
	}
}

// biome-ignore lint/style/noCommonJs: Jest reporters are loaded through CommonJS.
module.exports = BazelReporter;

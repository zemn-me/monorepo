
import { local } from "@pulumi/command";
import { all, ComponentResource, ComponentResourceOptions, Input, output } from "@pulumi/pulumi";

import { copybaraBin } from '#root/ts/cmd/copybara/copybara.js';

export interface SafeCommandArgs {
    interpreter: Input<string[]>;
    environment?: Input<{ [key: string]: Input<string> }>;
}

export class SafeCommand extends ComponentResource {
    stdout: Input<string>;
    stderr: Input<string>;

    constructor(name: string, args: SafeCommandArgs, opts?: ComponentResourceOptions) {
        super("ts:pulumi:lib:safecommand:SafeCommand", name, args, opts);

        // Wrap command execution to always return exit code 0
        const wrappedInterpreter = all([args.interpreter]).apply(([interpreter]) => [
			"sh", "-c", "\"$@\" || exit 0", "--", ...interpreter ?? []
        ]);

        // Execute the command
        const run = new local.Command(`${name}_run`, {
            interpreter: wrappedInterpreter,
            environment: args.environment ?? {},
            triggers: [Math.random()] // Ensures the command runs fresh each time
        }, { parent: this });

        // Capture logs
        this.stdout = run.stdout;
        this.stderr = run.stderr;

        // Print logs to console
        all([this.stdout, this.stderr]).apply(([stdout, stderr]) =>
            // eslint-disable-next-line no-console
            console.log(stdout, stderr)
        );
    }
}

export interface CopybaraArgs {
	args?: Input<string[]>
	configPath: Input<string>
	githubToken?: Input<string>
	staging: Input<boolean>
}

export class Copybara extends ComponentResource {
	/**
	 * URI uniquely identifying the image as landed in the repo.
	 */
	constructor(
		name: string,
		args: CopybaraArgs,
		opts?: ComponentResourceOptions
	) {
		super("ts:pulumi:lib:copybara:copybara",
			name, args, opts,
		);

		const interpreterArgs =
			all([output(args.args ?? []), args.configPath]).apply(
				([args, configPath]) => [
					configPath,
					...args
				]
			);
		const interpreter = args.staging ? 'echo' : copybaraBin;

		const interpreterParam = all([interpreter, interpreterArgs]).apply(
			([interpreter, args]) => [
				interpreter,
				...args
			]
		)

		const run = new SafeCommand(`${name}_run`, {
			environment: output(args.githubToken).apply(
				GITHUB_TOKEN => GITHUB_TOKEN ? { GITHUB_TOKEN } as {
					[key: string]: Input<string>;
				} : {}
			),
			interpreter: interpreterParam,
		}, { parent: this });


		all([run.stdout, run.stderr]).apply(([a, b]) =>
			// eslint-disable-next-line no-console
			console.log(a, b));



	}
}

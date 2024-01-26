import { all, Input } from '@pulumi/pulumi';

type TagSet = Input<Record<string, Input<string>>>;

export const mergeTags = (a?: TagSet, b?: TagSet): TagSet =>
	all([a, b]).apply(([a, b]) => ({ ...a, ...b }));

/**
 * For tags whose value isn't important.
 *
 * Gives them a value of 'true' without too
 * much fuss.
 */
export const tagTrue = (a: Input<string>): TagSet =>
	all([a]).apply(([a]) => ({ [a!]: 'true' }));

/**
 * @see https://www.pulumi.com/ai/answers/i8aRwwNKe95cMeFS11hgFB/implementing-aws-cost-allocation-tags
 * @see https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API_budgets_CreateBudget.html
 */
export const tagsToFilter = (a: TagSet): Input<Input<string>[]> =>
	all([a]).apply(([a]) => Object.entries(a!).map(kv => kv.join('$')));

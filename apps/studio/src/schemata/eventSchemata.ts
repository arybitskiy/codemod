import * as S from '@effect/schema/Schema';
import { offsetRangeSchema } from './offsetRangeSchemata';

export const eventSchema = S.union(
	S.struct({
		hashDigest: S.string,
		kind: S.literal('jscodeshiftApplyString'),
		codemodSourceRange: offsetRangeSchema,
		timestamp: S.number,
		mode: S.literal('control'),
	}),
	S.struct({
		hashDigest: S.string,
		kind: S.literal('path'),
		codemodSourceRange: offsetRangeSchema,
		snippetBeforeRanges: S.array(offsetRangeSchema),
		nodeType: S.string,
		timestamp: S.number,
		mode: S.union(S.literal('lookup'), S.literal('replacement')),
		codes: S.array(S.string),
	}),
	S.struct({
		hashDigest: S.string,
		kind: S.literal('pathReplace'),
		codemodSourceRange: offsetRangeSchema,
		snippetBeforeRanges: S.array(offsetRangeSchema),
		nodeType: S.string,
		timestamp: S.number,
		mode: S.literal('replacement'),
		codes: S.array(S.string),
	}),
	S.struct({
		hashDigest: S.string,
		kind: S.literal('collectionFind'),
		codemodSourceRange: offsetRangeSchema,
		snippetBeforeRanges: S.array(offsetRangeSchema),
		nodeType: S.string,
		timestamp: S.number,
		mode: S.literal('lookup'),
	}),
	S.struct({
		hashDigest: S.string,
		kind: S.literal('collectionPaths'),
		codemodSourceRange: offsetRangeSchema,
		snippetBeforeRanges: S.array(offsetRangeSchema),
		timestamp: S.number,
		mode: S.literal('lookup'),
	}),
	S.struct({
		hashDigest: S.string,
		kind: S.literal('collectionRemove'),
		codemodSourceRange: offsetRangeSchema,
		snippetBeforeRanges: S.array(offsetRangeSchema),
		nodeType: S.string,
		timestamp: S.number,
		mode: S.literal('removal'),
	}),
	S.struct({
		hashDigest: S.string,
		kind: S.literal('collectionReplace'),
		codemodSourceRange: offsetRangeSchema,
		snippetBeforeRanges: S.array(offsetRangeSchema),
		nodeType: S.string,
		codes: S.array(S.string),
		timestamp: S.number,
		mode: S.literal('replacement'),
	}),
	S.struct({
		hashDigest: S.string,
		kind: S.literal('collectionToSource'),
		nodeType: S.string,
		codemodSourceRange: offsetRangeSchema,
		timestamp: S.number,
		mode: S.literal('control'),
	}),
	S.struct({
		hashDigest: S.string,
		kind: S.literal('printedMessage'),
		codemodSourceRange: offsetRangeSchema,
		message: S.string,
		timestamp: S.number,
		mode: S.literal('control'),
	}),
	S.struct({
		hashDigest: S.string,
		kind: S.literal('codemodExecutionError'),
		codemodSourceRange: offsetRangeSchema,
		message: S.string,
		timestamp: S.number,
		mode: S.literal('control'),
	}),
);

export type Event = S.To<typeof eventSchema>;
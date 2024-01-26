import { format } from 'node:util';
import type { ConsoleKind } from './schemata/consoleKindSchema.js';
import { parseConsoleKind } from './schemata/consoleKindSchema.js';

export const buildVmConsole =
	(callback: (kind: ConsoleKind, message: string) => void) =>
	(k: unknown, data: unknown, ...args: unknown[]) => {
		const kind = parseConsoleKind(k);

		const message = format(data, ...args);

		callback(kind, message);
	};

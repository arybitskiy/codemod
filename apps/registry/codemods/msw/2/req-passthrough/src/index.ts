import type { ParameterDeclaration, SourceFile } from 'ts-morph';
import {
	SyntaxKind,
	type ArrowFunction,
	type BindingElement,
	type Block,
	type CallExpression,
	type FunctionExpression,
	type ImportSpecifier,
} from 'ts-morph';

function addNamedImportDeclaration(
	sourceFile: SourceFile,
	moduleSpecifier: string,
	name: string,
): ImportSpecifier {
	const importDeclaration =
		sourceFile.getImportDeclaration(moduleSpecifier) ??
		sourceFile.addImportDeclaration({ moduleSpecifier });

	const existing = importDeclaration
		.getNamedImports()
		.find((specifier) => specifier.getName() === name);

	return existing ?? importDeclaration.addNamedImport({ name });
}

function getImportDeclarationAlias(
	sourceFile: SourceFile,
	moduleSpecifier: string,
	name: string,
) {
	const importDeclaration = sourceFile.getImportDeclaration(moduleSpecifier);
	if (!importDeclaration) {
		return null;
	}

	const namedImport = importDeclaration
		.getNamedImports()
		.find((specifier) => specifier.getName() === name);

	if (!namedImport) {
		return null;
	}

	return namedImport.getAliasNode()?.getText() || namedImport.getName();
}

function replaceDestructureAliases(bindingEl: BindingElement) {
	const directIds = bindingEl.getChildrenOfKind(SyntaxKind.Identifier);

	const [nameNode, aliasNode] = directIds;

	if (!nameNode || !aliasNode) {
		return;
	}

	if (directIds.length === 2) {
		aliasNode
			.findReferencesAsNodes()
			.forEach((ref) => ref.replaceWithText(nameNode.getText()));
	}
}

function replaceReferences(
	codeBlock: SourceFile | Block | ArrowFunction | FunctionExpression,
	replaced: string[],
	callerName: string | undefined,
) {
	let didReplace = false;

	codeBlock
		.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
		.forEach((accessExpr) => {
			if (
				replaced.includes(accessExpr.getName()) &&
				accessExpr
					.getChildrenOfKind(SyntaxKind.Identifier)[0]
					?.getText() === callerName
			) {
				const accessed = accessExpr
					.getChildrenOfKind(SyntaxKind.Identifier)
					.at(-1)
					?.getText();
				if (!accessed) {
					throw new Error('Could not find accessed identifier');
				}

				didReplace = true;
				accessExpr.replaceWithText(accessed);
			}
		});

	codeBlock
		.getDescendantsOfKind(SyntaxKind.ObjectBindingPattern)
		.forEach((bindingPattern) => {
			const toReplaceFromBinding: string[] = [];

			bindingPattern
				.getDescendantsOfKind(SyntaxKind.BindingElement)
				.forEach((bindingEl) => {
					const destructuredReplaced = bindingEl
						.getDescendantsOfKind(SyntaxKind.Identifier)
						.find((d) => replaced.includes(d.getText()));
					if (destructuredReplaced) {
						replaceDestructureAliases(bindingEl);

						toReplaceFromBinding.push(bindingEl.getText());
					}
				});

			if (toReplaceFromBinding.length) {
				didReplace = true;

				bindingPattern?.replaceWithText(
					bindingPattern
						.getText()
						.replace(
							new RegExp(
								`(,\\s*)?(${toReplaceFromBinding.join(
									'|',
								)})+(\\s*,)?`,
								'g',
							),
							(fullMatch, p1, _p2, p3) => {
								if (fullMatch && ![p1, p3].includes(fullMatch))
									return '';
								return fullMatch;
							},
						),
				);

				if (
					!bindingPattern.getDescendantsOfKind(SyntaxKind.Identifier)
						.length
				) {
					bindingPattern
						.getAncestors()
						.find(
							(a) =>
								a.getKind() === SyntaxKind.VariableDeclaration,
						)
						?.asKindOrThrow(SyntaxKind.VariableDeclaration)
						.remove();
				} else {
					bindingPattern.formatText();
				}
			}
		});

	return didReplace;
}

function isMSWCall(sourceFile: SourceFile, callExpr: CallExpression) {
	const httpCallerName = getImportDeclarationAlias(sourceFile, 'msw', 'http');
	const graphqlCallerName = getImportDeclarationAlias(
		sourceFile,
		'msw',
		'graphql',
	);

	const identifiers =
		callExpr
			.getChildrenOfKind(SyntaxKind.PropertyAccessExpression)
			.at(0)
			?.getChildrenOfKind(SyntaxKind.Identifier) ?? [];

	const caller = identifiers.at(0);

	if (!caller) {
		return false;
	}

	const method = identifiers.at(1) ?? caller;

	const methodText = method.getText();

	const isHttpCall =
		caller.getText() === httpCallerName &&
		// This is what would be cool to get through inferring the type via
		// typeChecker/langServer/diagnostics etc, for example
		[
			'all',
			'get',
			'post',
			'put',
			'patch',
			'delete',
			'head',
			'options',
		].includes(methodText);

	const isGraphQLCall =
		caller.getText() === graphqlCallerName &&
		['query', 'mutation'].includes(methodText);

	return isHttpCall || isGraphQLCall;
}

function getCallbackData(
	expression: CallExpression,
):
	| [
			Block | FunctionExpression | ArrowFunction,
			ReadonlyArray<ParameterDeclaration>,
			FunctionExpression | ArrowFunction,
	  ]
	| null {
	const mockCallback = expression.getArguments().at(1) ?? null;

	if (mockCallback === null) {
		return null;
	}

	const cbParams = mockCallback.getChildrenOfKind(SyntaxKind.Parameter);

	const syntaxCb =
		mockCallback.asKind(SyntaxKind.ArrowFunction) ??
		mockCallback.asKind(SyntaxKind.FunctionExpression) ??
		null;

	if (syntaxCb === null) {
		return null;
	}

	const callbackBody =
		mockCallback.getChildrenOfKind(SyntaxKind.Block).at(0) ?? syntaxCb;

	return [callbackBody, cbParams, syntaxCb];
}

function shouldProcessFile(sourceFile: SourceFile): boolean {
	return (
		sourceFile
			.getImportDeclarations()
			.find((decl) =>
				decl.getModuleSpecifier().getLiteralText().startsWith('msw'),
			) !== undefined
	);
}

// https://mswjs.io/docs/migrations/1.x-to-2.x/#reqpassthrough
export function handleSourceFile(sourceFile: SourceFile): string | undefined {
	if (!shouldProcessFile(sourceFile)) {
		return undefined;
	}

	sourceFile
		.getDescendantsOfKind(SyntaxKind.CallExpression)
		.filter((callExpr) => isMSWCall(sourceFile, callExpr))
		.forEach((expression) => {
			const callbackData = getCallbackData(expression);
			if (callbackData === null) {
				return;
			}

			const [callbackBody, callbackParams] = callbackData;
			const [reqParam] = callbackParams;

			const didReplacePassthrough = replaceReferences(
				callbackBody,
				['passthrough'],
				reqParam?.getText(),
			);
			if (didReplacePassthrough) {
				addNamedImportDeclaration(sourceFile, 'msw', 'passthrough');
			}
		});

	return sourceFile.getFullText();
}

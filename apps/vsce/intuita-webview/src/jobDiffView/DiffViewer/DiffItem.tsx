import { forwardRef, KeyboardEvent, memo, useCallback, useState } from 'react';
import { Collapsable } from '../Components/Collapsable';
import { exportToCodemodStudio, reportIssue } from '../util';
import { Header } from './Container';
import { Diff, DiffComponent } from './Diff';
import './DiffItem.css';
import { PanelViewProps } from '../../../../src/components/webview/panelViewProps';
import debounce from '../../shared/utilities/debounce';
import { vscode } from '../../shared/utilities/vscode';

type Props = PanelViewProps & { kind: 'JOB' } & {
	viewType: 'inline' | 'side-by-side';
	theme: string;
};

export const JobDiffView = memo(
	forwardRef<HTMLDivElement, Props>(
		(
			{
				viewType,
				jobHash,
				jobKind,
				oldFileContent,
				newFileContent,
				originalNewFileContent,
				oldFileTitle,
				reviewed,
				title,
				theme,
				caseHash,
			}: Props,
			ref,
		) => {
			const [diff, setDiff] = useState<Diff | null>(null);

			const report = useCallback(() => {
				reportIssue(
					jobHash,
					oldFileContent ?? '',
					originalNewFileContent ?? '',
					originalNewFileContent !== newFileContent
						? newFileContent
						: null,
				);
			}, [
				jobHash,
				oldFileContent,
				newFileContent,
				originalNewFileContent,
			]);

			const exportToCS = useCallback(() => {
				exportToCodemodStudio(
					jobHash,
					oldFileContent ?? '',
					newFileContent ?? '',
				);
			}, [jobHash, oldFileContent, newFileContent]);

			const handleDiffCalculated = (diff: Diff) => {
				setDiff(diff);
			};

			const handleContentChange = debounce((newContent: string) => {
				const changed = newContent !== newFileContent;
				if (changed) {
					vscode.postMessage({
						kind: 'webview.panel.contentModified',
						newContent,
						jobHash,
					});
				}
			}, 1000);

			return (
				<div
					ref={ref}
					className="pb-2-5 diff-view-container h-full px-5"
					tabIndex={0}
					onKeyDown={(event: KeyboardEvent) => {
						if (event.key === 'ArrowLeft') {
							event.preventDefault();

							vscode.postMessage({
								kind: 'webview.panel.focusOnChangeExplorer',
							});
						}
					}}
				>
					<Collapsable
						defaultExpanded={true}
						className="h-full overflow-hidden rounded"
						headerClassName="p-10"
						contentClassName="p-10 h-full"
						headerSticky
						headerComponent={
							<Header
								diff={diff}
								modifiedByUser={
									originalNewFileContent !== newFileContent
								}
								oldFileTitle={oldFileTitle ?? ''}
								jobKind={jobKind}
								caseHash={caseHash}
								jobHash={jobHash}
								title={title ?? ''}
								reviewed={reviewed}
								onReportIssue={report}
								onFixInStudio={exportToCS}
							/>
						}
					>
						<DiffComponent
							theme={theme}
							viewType={viewType}
							oldFileContent={oldFileContent}
							newFileContent={newFileContent}
							onDiffCalculated={handleDiffCalculated}
							onChange={handleContentChange}
							jobHash={jobHash}
						/>
					</Collapsable>
				</div>
			);
		},
	),
);

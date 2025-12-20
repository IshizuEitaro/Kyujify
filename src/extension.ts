import * as vscode from 'vscode';
import { convertText, getConversionPairs, getNextVariantMap, cycleVariantsInText } from './conversion';

export function activate(context: vscode.ExtensionContext) {
	console.log('Kyujify extension activating...');

	const toKyujitai = vscode.commands.registerCommand('kyujify.toKyujitai', async () => {
		console.log('[Kyujify] toKyujitai command triggered.');
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			console.log('[Kyujify] No active text editor.');
			return; // No open text editor
		}
		const settings = vscode.workspace.getConfiguration('kyujify');
		const defaultPairs = await getConversionPairs(settings, context);
		const symbol = settings.get<string>('lineStartSymbol', '');
		const exclusions = settings.get<string[]>('exclusions', []);

		const selection = editor.selection;
		const text = selection.isEmpty ? editor.document.getText() : editor.document.getText(selection);
		console.log(`[Kyujify] Text to convert (first 100 chars): ${text.substring(0, 100)}`);

		const convertedText = convertText(text, 'kyujitai', defaultPairs, exclusions, symbol);
		console.log(`[Kyujify] Converted text (first 100 chars): ${convertedText.substring(0, 100)}`);

		console.log('[Kyujify] Applying edit to editor...');
		editor.edit(editBuilder => {
			if (selection.isEmpty) {
				const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
				const fullRange = new vscode.Range(new vscode.Position(0, 0), lastLine.range.end);
				editBuilder.replace(fullRange, convertedText);
			} else {
				editBuilder.replace(selection, convertedText);
			}
		}).then(success => {
			console.log(`[Kyujify] Edit applied successfully: ${success}`);
			if (!success) {
				vscode.window.showErrorMessage('Kyujify: Failed to apply text conversion.');
			}
		});
	});

	const toShinjitai = vscode.commands.registerCommand('kyujify.toShinjitai', async () => {
		console.log('[Kyujify] toShinjitai command triggered.');
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			console.log('[Kyujify] No active text editor.');
			return; // No open text editor
		}
		const settings = vscode.workspace.getConfiguration('kyujify');
		const defaultPairs = await getConversionPairs(settings, context);
		const symbol = settings.get<string>('lineStartSymbol', '');
		const exclusions = settings.get<string[]>('exclusions', []);

		const selection = editor.selection;
		const text = selection.isEmpty ? editor.document.getText() : editor.document.getText(selection);
		console.log(`[Kyujify] Text to convert (first 100 chars): ${text.substring(0, 100)}`);

		const convertedText = convertText(text, 'shinjitai', defaultPairs, exclusions, symbol);
		console.log(`[Kyujify] Converted text (first 100 chars): ${convertedText.substring(0, 100)}`);

		console.log('[Kyujify] Applying edit to editor...');
		editor.edit(editBuilder => {
			if (selection.isEmpty) {
				const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
				const fullRange = new vscode.Range(new vscode.Position(0, 0), lastLine.range.end);
				editBuilder.replace(fullRange, convertedText);
			} else {
				editBuilder.replace(selection, convertedText);
			}
		}).then(success => {
			console.log(`[Kyujify] Edit applied successfully: ${success}`);
			if (!success) {
				vscode.window.showErrorMessage('Kyujify: Failed to apply text conversion.');
			}
		});
	});

	const cycleVariants = vscode.commands.registerCommand('kyujify.cycleVariants', async () => {
		console.log('[Kyujify] cycleVariants command triggered.');
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			console.log('[Kyujify] No active text editor.');
			return;
		}

		const selection = editor.selection;
		const text = selection.isEmpty
			? editor.document.getText()
			: editor.document.getText(selection);

		console.log(`[Kyujify] Text to cycle (first 100 chars): ${text.substring(0, 100)}`);

		const nextVariantMap = await getNextVariantMap(context);
		if (!nextVariantMap || Object.keys(nextVariantMap).length === 0) {
			console.log('[Kyujify] No variant mappings available; cycleVariants is a no-op.');
			return;
		}

		const cycledText = cycleVariantsInText(text, nextVariantMap);
		console.log(`[Kyujify] Cycled text (first 100 chars): ${cycledText.substring(0, 100)}`);

		console.log('[Kyujify] Applying cycleVariants edit to editor...');
		editor.edit(editBuilder => {
			if (selection.isEmpty) {
				const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
				const fullRange = new vscode.Range(new vscode.Position(0, 0), lastLine.range.end);
				editBuilder.replace(fullRange, cycledText);
			} else {
				editBuilder.replace(selection, cycledText);
			}
		}).then(success => {
			console.log(`[Kyujify] cycleVariants edit applied successfully: ${success}`);
			if (!success) {
				vscode.window.showErrorMessage('Kyujify: Failed to apply variant cycling.');
			}
		});
	});

	context.subscriptions.push(toKyujitai, toShinjitai, cycleVariants);
}

// This method is called when your extension is deactivated
export function deactivate() {}
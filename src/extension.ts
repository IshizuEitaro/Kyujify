import * as vscode from "vscode";
import {
  applyKakikae,
  convertText,
  getConversionPairs,
  getKakikaeMap,
  getNextVariantMap,
  cycleVariantsInText,
} from "./conversion";

export function activate(context: vscode.ExtensionContext) {
  console.log("Kyujify extension activating...");

  const toKyujitai = vscode.commands.registerCommand("kyujify.toKyujitai", async () => {
    console.log("[Kyujify] toKyujitai command triggered.");
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      console.log("[Kyujify] No active text editor.");
      return;
    }
    const selection = editor.selection;
    const documentVersion = editor.document.version;

    const settings = vscode.workspace.getConfiguration("kyujify");
    const defaultPairs = await getConversionPairs(settings, context);

    if (editor.document.version !== documentVersion) {
      vscode.window.showWarningMessage(
        "Kyujify: Document changed before conversion finished. Please run the command again.",
      );
      return;
    }

    const symbol = settings.get<string>("lineStartSymbol", "");
    const exclusions = settings.get<string[]>("exclusions", []);

    let range: vscode.Range;
    if (selection.isEmpty) {
      const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
      range = new vscode.Range(new vscode.Position(0, 0), lastLine.range.end);
    } else if (symbol) {
      // Expand to full lines if symbol is used, to ensure we catch the prefix
      const startLine = selection.start.line;
      const endLine =
        selection.end.character === 0 && selection.end.line > selection.start.line
          ? selection.end.line - 1
          : selection.end.line;
      const endLineObj = editor.document.lineAt(endLine);
      range = new vscode.Range(startLine, 0, endLine, endLineObj.range.end.character);
    } else {
      range = selection;
    }

    const text = editor.document.getText(range);
    console.log(`[Kyujify] Text to convert (length): ${text.length}`);

    const convertedText = convertText(text, "kyujitai", defaultPairs, exclusions, symbol);
    console.log(`[Kyujify] Converted text (length): ${convertedText.length}`);

    console.log("[Kyujify] Applying edit to editor...");
    editor
      .edit((editBuilder) => {
        editBuilder.replace(range, convertedText);
      })
      .then((success) => {
        console.log(`[Kyujify] Edit applied successfully: ${success}`);
        if (!success) {
          vscode.window.showErrorMessage("Kyujify: Failed to apply text conversion.");
        }
      });
  });

  const toShinjitai = vscode.commands.registerCommand("kyujify.toShinjitai", async () => {
    console.log("[Kyujify] toShinjitai command triggered.");
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      console.log("[Kyujify] No active text editor.");
      return;
    }
    const selection = editor.selection;
    const documentVersion = editor.document.version;

    const settings = vscode.workspace.getConfiguration("kyujify");
    const defaultPairs = await getConversionPairs(settings, context);

    if (editor.document.version !== documentVersion) {
      vscode.window.showWarningMessage(
        "Kyujify: Document changed before conversion finished. Please run the command again.",
      );
      return;
    }

    const symbol = settings.get<string>("lineStartSymbol", "");
    const exclusions = settings.get<string[]>("exclusions", []);

    let range: vscode.Range;
    if (selection.isEmpty) {
      const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
      range = new vscode.Range(new vscode.Position(0, 0), lastLine.range.end);
    } else if (symbol) {
      const startLine = selection.start.line;
      const endLine =
        selection.end.character === 0 && selection.end.line > selection.start.line
          ? selection.end.line - 1
          : selection.end.line;
      const endLineObj = editor.document.lineAt(endLine);
      range = new vscode.Range(startLine, 0, endLine, endLineObj.range.end.character);
    } else {
      range = selection;
    }

    const text = editor.document.getText(range);
    console.log(`[Kyujify] Text to convert (length): ${text.length}`);

    const convertedText = convertText(text, "shinjitai", defaultPairs, exclusions, symbol);
    console.log(`[Kyujify] Converted text (length): ${convertedText.length}`);

    console.log("[Kyujify] Applying edit to editor...");
    editor
      .edit((editBuilder) => {
        editBuilder.replace(range, convertedText);
      })
      .then((success) => {
        console.log(`[Kyujify] Edit applied successfully: ${success}`);
        if (!success) {
          vscode.window.showErrorMessage("Kyujify: Failed to apply text conversion.");
        }
      });
  });

  const cycleVariants = vscode.commands.registerCommand("kyujify.cycleVariants", async () => {
    console.log("[Kyujify] cycleVariants command triggered.");
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      console.log("[Kyujify] No active text editor.");
      return;
    }

    const selection = editor.selection;
    const documentVersion = editor.document.version;

    const settings = vscode.workspace.getConfiguration("kyujify");
    const nextVariantMap = await getNextVariantMap(context);

    if (editor.document.version !== documentVersion) {
      vscode.window.showWarningMessage(
        "Kyujify: Document changed before conversion finished. Please run the command again.",
      );
      return;
    }

    const symbol = settings.get<string>("lineStartSymbol", "");

    let range: vscode.Range;
    if (selection.isEmpty) {
      const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
      range = new vscode.Range(new vscode.Position(0, 0), lastLine.range.end);
    } else if (symbol) {
      const startLine = selection.start.line;
      const endLine =
        selection.end.character === 0 && selection.end.line > selection.start.line
          ? selection.end.line - 1
          : selection.end.line;
      const endLineObj = editor.document.lineAt(endLine);
      range = new vscode.Range(startLine, 0, endLine, endLineObj.range.end.character);
    } else {
      range = selection;
    }

    const text = editor.document.getText(range);
    console.log(`[Kyujify] Text to cycle (length): ${text.length}`);

    if (!nextVariantMap || Object.keys(nextVariantMap).length === 0) {
      console.log("[Kyujify] No variant mappings available; cycleVariants is a no-op.");
      return;
    }

    const cycledText = cycleVariantsInText(text, nextVariantMap, symbol);
    console.log(`[Kyujify] Cycled text (length): ${cycledText.length}`);

    console.log("[Kyujify] Applying cycleVariants edit to editor...");
    editor
      .edit((editBuilder) => {
        editBuilder.replace(range, cycledText);
      })
      .then((success) => {
        console.log(`[Kyujify] cycleVariants edit applied successfully: ${success}`);
        if (!success) {
          vscode.window.showErrorMessage("Kyujify: Failed to apply variant cycling.");
        }
      });
  });

  const applyKakikaeCmd = vscode.commands.registerCommand("kyujify.applyKakikae", async () => {
    console.log("[Kyujify] applyKakikae command triggered.");
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      console.log("[Kyujify] No active text editor.");
      return;
    }

    const selection = editor.selection;
    const documentVersion = editor.document.version;

    const settings = vscode.workspace.getConfiguration("kyujify");
    const kakikaeMap = await getKakikaeMap(settings, context, "toShinjitai");

    if (editor.document.version !== documentVersion) {
      vscode.window.showWarningMessage(
        "Kyujify: Document changed before conversion finished. Please run the command again.",
      );
      return;
    }

    const exclusions = settings.get<string[]>("exclusions", []);
    const symbol = settings.get<string>("lineStartSymbol", "");

    let range: vscode.Range;
    if (selection.isEmpty) {
      const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
      range = new vscode.Range(new vscode.Position(0, 0), lastLine.range.end);
    } else if (symbol) {
      const startLine = selection.start.line;
      const endLine =
        selection.end.character === 0 && selection.end.line > selection.start.line
          ? selection.end.line - 1
          : selection.end.line;
      const endLineObj = editor.document.lineAt(endLine);
      range = new vscode.Range(startLine, 0, endLine, endLineObj.range.end.character);
    } else {
      range = selection;
    }

    const text = editor.document.getText(range);
    console.log(`[Kyujify] Text for kakikae (length): ${text.length}`);
    if (!kakikaeMap || Object.keys(kakikaeMap).length === 0) {
      console.log("[Kyujify] No kakikae mappings available; applyKakikae is a no-op.");
      return;
    }

    const convertedText = applyKakikae(text, kakikaeMap, exclusions, symbol);
    console.log(`[Kyujify] Kakikae-converted text (length): ${convertedText.length}`);

    console.log("[Kyujify] Applying kakikae edit to editor...");
    editor
      .edit((editBuilder) => {
        editBuilder.replace(range, convertedText);
      })
      .then((success) => {
        console.log(`[Kyujify] applyKakikae edit applied successfully: ${success}`);
        if (!success) {
          vscode.window.showErrorMessage("Kyujify: Failed to apply kakikae.");
        }
      });
  });

  const reverseKakikaeCmd = vscode.commands.registerCommand("kyujify.reverseKakikae", async () => {
    console.log("[Kyujify] reverseKakikae command triggered.");
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      console.log("[Kyujify] No active text editor.");
      return;
    }

    const selection = editor.selection;
    const documentVersion = editor.document.version;

    const settings = vscode.workspace.getConfiguration("kyujify");
    const kakikaeMap = await getKakikaeMap(settings, context, "toKyujitai");

    if (editor.document.version !== documentVersion) {
      vscode.window.showWarningMessage(
        "Kyujify: Document changed before conversion finished. Please run the command again.",
      );
      return;
    }

    const exclusions = settings.get<string[]>("exclusions", []);
    const symbol = settings.get<string>("lineStartSymbol", "");

    let range: vscode.Range;
    if (selection.isEmpty) {
      const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
      range = new vscode.Range(new vscode.Position(0, 0), lastLine.range.end);
    } else if (symbol) {
      const startLine = selection.start.line;
      const endLine =
        selection.end.character === 0 && selection.end.line > selection.start.line
          ? selection.end.line - 1
          : selection.end.line;
      const endLineObj = editor.document.lineAt(endLine);
      range = new vscode.Range(startLine, 0, endLine, endLineObj.range.end.character);
    } else {
      range = selection;
    }

    const text = editor.document.getText(range);
    console.log(`[Kyujify] Text for reverse kakikae (length): ${text.length}`);
    if (!kakikaeMap || Object.keys(kakikaeMap).length === 0) {
      console.log("[Kyujify] No kakikae mappings available; reverseKakikae is a no-op.");
      return;
    }

    const convertedText = applyKakikae(text, kakikaeMap, exclusions, symbol);
    console.log(`[Kyujify] Reverse Kakikae-converted text (length): ${convertedText.length}`);

    console.log("[Kyujify] Applying reverse kakikae edit to editor...");
    editor
      .edit((editBuilder) => {
        editBuilder.replace(range, convertedText);
      })
      .then((success) => {
        console.log(`[Kyujify] reverseKakikae edit applied successfully: ${success}`);
        if (!success) {
          vscode.window.showErrorMessage("Kyujify: Failed to apply reverse kakikae.");
        }
      });
  });

  context.subscriptions.push(
    toKyujitai,
    toShinjitai,
    cycleVariants,
    applyKakikaeCmd,
    reverseKakikaeCmd,
  );
}

export function deactivate() {}

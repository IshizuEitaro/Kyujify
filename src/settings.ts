import * as vscode from "vscode";

interface KyujifySettings {
  conversionPairsFile: string;
  lineStartSymbol: string;
  exclusions: string[];
}

export function getSettings(config: vscode.WorkspaceConfiguration): KyujifySettings {
  const conversionPairsFile = config.get<string>(
    "conversionPairsFile",
    "./data/default_pairs.json",
  );
  const lineStartSymbol = config.get<string>("lineStartSymbol", "");
  const exclusions = config.get<string[]>("exclusions", []);
  return { conversionPairsFile, lineStartSymbol, exclusions };
}

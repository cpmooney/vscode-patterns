import * as vscode from "vscode";
import * as prompt from "./prompts";
import {AskCopilot, registerCommand} from "./extension-utilities";
import {
  FileContent,
  writeFileContentsToFiles,
} from "./file-utilities";
import { getFileContentInfoForPattern } from "./patterns";

export const conversationHandler = async (
  userInput: string,
  chatStream: vscode.ChatResponseStream,
  askCopilot: AskCopilot
) => {
  chatStream.progress("Processing . . .");

  const fileContents = getFileContentInfoForPattern('sdr-entity');

  const copilotResponse = await askCopilot(
    prompt.adaptToUseCase(fileContents, userInput)
  );

  chatStream.markdown("All done!");

  chatStream.button({
    title: "Write to Files",
    command: "write-to-file",
    arguments: [copilotResponse, '/'],
  });
};

export const registerCommands = (context: vscode.ExtensionContext) => {
  registerCommand(context, "write-to-file", writeResponseToFiles);
};

async function writeResponseToFiles(
  chatResponse: string,
  baseDirectory: string
) {
  const fileContents: FileContent[]  = findJsonInString<FileContent[]>(chatResponse);
  writeFileContentsToFiles(fileContents, baseDirectory);
  await Promise.all(fileContents.map(async ({ fileName }) => { await openInEditorAndGiveFocus(fileName); }));
}

function findJsonInString<T>(text: string): T {
  const regex = /```(?:json)?\n([\s\S]*?)\n```/;
	const jsonAsString = text.match(regex)?.[1] ?? '';
	return JSON.parse(jsonAsString) as T;
}

async function openInEditorAndGiveFocus(filePath: string) {
  const doc = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(doc, { preview: false });
}

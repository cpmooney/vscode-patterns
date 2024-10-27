import * as vscode from "vscode";
import * as prompt from "./prompts";
import {AskCopilot, registerCommand} from "./extension-utilities";
import {
  FileContent,
  getRootPath,
  writeFileContentsToFiles,
} from "./file-utilities";
import { getFileContentInfoForPattern } from "./pattern-helpers";

export const conversationHandler = async (
  userInput: string,
  chatStream: vscode.ChatResponseStream,
  askCopilot: AskCopilot
) => {
  chatStream.progress("Processing . . .");

  const fileContents = getFileContentInfoForPattern();

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
  const fileContents  = findJsonInString<FileContent[]>(chatResponse);
  writeFileContentsToFiles(fileContents, baseDirectory);
  await openInEditorAndGiveFocus(baseDirectory);
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

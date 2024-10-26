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
    arguments: [copilotResponse, getRootPath()],
  });
};

export const registerCommands = (context: vscode.ExtensionContext) => {
  registerCommand(context, "write-to-file", writeResponseToFiles);
};

async function writeResponseToFiles(
  espanolResponse: string,
  baseDirectory: string
) {
  const fileContents = findJsonInString<FileContent[]>(espanolResponse);
  writeFileContentsToFiles(fileContents, baseDirectory);
  openInEditorAndGiveFocus(baseDirectory);
}

function findJsonInString<T>(text: string): T {
  const regex = /```(?:json)?\n([\s\S]*?)\n```/;
  const jsonAsString = text.match(regex)?.[1] ?? "";
  return JSON.parse(jsonAsString) as T;
}

function openInEditorAndGiveFocus(filePath: string) {
  vscode.workspace.openTextDocument(filePath).then((doc) => {
    vscode.window.showTextDocument(doc, {preview: false});
  });
}

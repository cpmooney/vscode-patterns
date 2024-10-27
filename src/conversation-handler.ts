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
  chatResponse: string,
  baseDirectory: string
) {
  const fileContents  = findCodeBlocksInString(chatResponse);
  writeFileContentsToFiles(fileContents, baseDirectory);
  openInEditorAndGiveFocus(baseDirectory);
}

function findCodeBlocksInString(text: string): FileContent[] {
  const regex = /\*\*(.*?)\*\*```(?:json|sql|java)?\n([\s\S]*?)\n```/g;
  const matches: FileContent[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    const fileName = match[1].trim();
    const contents = match[2].trim();
    matches.push({ fileName, contents });
  }

  return matches;
}

function openInEditorAndGiveFocus(filePath: string) {
  vscode.workspace.openTextDocument(filePath).then((doc) => {
    vscode.window.showTextDocument(doc, {preview: false});
  });
}

import * as vscode from "vscode";
import * as prompt from "./prompts";
import {AskCopilot, registerCommand} from "./extension-utilities";
import {
  FileContent,
  getFileContentInfoFromUri,
  getRootPath,
  isDirectory,
  writeFileContentsToFiles,
} from "./file-utilities";

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

function getFileContentInfoForPattern(): FileContent[] {
  const myPatternDirectoryLocation = patternDirectoryLocation();
  return getFileContentInfoFromUri(myPatternDirectoryLocation);
}

function patternDirectoryLocation(): string {
  const patternDirectory = process.env.CODE_PATTERN_DIRECTORY;
  if (patternDirectory) {
    if (isDirectory(patternDirectory)) {
      return patternDirectory;
    } else {
      vscode.window.showErrorMessage(
        `CODE_PATTERN_DIRECTORY is set to ${patternDirectory} but that is not a valid directory.`
      );
      throw new Error("Invalid directory");
    }
  } else {
    vscode.window.showErrorMessage(
      "The CODE_PATTERN_DIRECTORY environment variable is not set."
    );
    throw new Error("Environment variable not set");
  }
}

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

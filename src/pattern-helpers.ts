import { FileContent, getFileContentInfoFromUri, isDirectory } from "./file-utilities";
import * as vscode from "vscode";

export function getFileContentInfoForPattern(): FileContent[] {
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
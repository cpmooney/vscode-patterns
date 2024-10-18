import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
	const registerCommand = (command: string, callback: (...args: any[]) => any) => {
		context.subscriptions.push(vscode.commands.registerCommand(command, callback));
	};

	vscode.chat.createChatParticipant("en-epsanol-chat-particpant", async (_request, _context, response, token) => {
		response.progress('Let me get back to you on that . . .');

		const chatModels = await vscode.lm.selectChatModels({ family: "gpt-4-turbo" });

		const textInEspanol = await askCopilot(`Translate the following file(s) into spanish: ${getTextFromActiveFile()}`, chatModels[0], token);

		const filenameInEspanol = await askCopilot(`Translate the following into spanish, preserving the extension: ${nameOfCurrentlyOpenFile()}`, chatModels[0], token);

		response.markdown(`--| ${textInEspanol} |--`);

		response.button({ title: 'Write to file', command: 'write-to-file', arguments: [filenameInEspanol, textInEspanol] });
	});

	registerCommand('write-to-file', writeTextToFile);
	registerCommand('enespanol.in-context-menu', async (uri: vscode.Uri) => {
		const fileContents = await getContentsFromFiles(uri);
		vscode.commands.executeCommand('vscode.chat.sendMessage', {
            participantId: 'en-epsanol-chat-particpant'
//			context: { fileContents }
        });
	});
}

async function getFilenamesInDirectory(uri: vscode.Uri): Promise<vscode.Uri[]> {
	const stat = await vscode.workspace.fs.stat(uri);
	if (stat.type !== vscode.FileType.Directory) {
		return [uri];
	}
    const files = await vscode.workspace.fs.readDirectory(uri);
    const result: vscode.Uri[] = [];

    for (const [name, type] of files) {
        const fileUri = vscode.Uri.joinPath(uri, name);
        if (type === vscode.FileType.File) {
            result.push(fileUri);
        } else if (type === vscode.FileType.Directory) {
            const subFiles = await getFilenamesInDirectory(fileUri);
            result.push(...subFiles);
        }
    }

    return result;
}

async function askCopilot(message: string, chatModel: vscode.LanguageModelChat, token: vscode.CancellationToken): Promise<string> {
	const response = await chatModel.sendRequest([vscode.LanguageModelChatMessage.User(message)], undefined, token);
	return await getTextFromResponse(response);
}

function guaranteeEditor(): vscode.TextEditor {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		throw new Error('No active text editor');
	}
	return editor;
}

function guranteeDocument(): vscode.TextDocument {
	return guaranteeEditor().document;
}

function getTextFromActiveFile(): string {
	return guranteeDocument().getText();
}

function nameOfCurrentlyOpenFile(): string {
	return path.basename(guranteeDocument().fileName);
}

async function writeTextToFile(filename: string, text: string) {
	const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder is open.');
        return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const filePath = path.join(rootPath, filename);
    const fileUri = vscode.Uri.file(filePath);

    const formattedText = formatToWidth(text, 80);
    const encodedText = new TextEncoder().encode(formattedText);

    try {
        await vscode.workspace.fs.writeFile(fileUri, encodedText);
        vscode.window.showInformationMessage(`File ${filename} created successfully.`);
    } catch (error) {
		if (error instanceof Error) {
            vscode.window.showErrorMessage(`Failed to create file ${filename}: ${error.message}`);
        } else {
            vscode.window.showErrorMessage(`Failed to create file ${filename}: Unknown error`);
        }
    }

	openInEditorAndGiveFocus(filePath);
}

function openInEditorAndGiveFocus(filePath: string) {
	vscode.workspace.openTextDocument(filePath).then((doc) => {
		vscode.window.showTextDocument(doc, { preview: false });
	});
}

function formatToWidth(text: string, linelength: number) {
	let result = '';
	let line = '';
	for (const word of text.split(' ')) {
		if (line.length + word.length > linelength) {
			result += line + '\n';
			line = '';
		}
		line += word + ' ';
	}
	return result + line;
}

async function getTextFromResponse(response: vscode.LanguageModelChatResponse): Promise<string> {
	let data = '';
	for await (const token of response.text) {
		data += token;
	}
	return data;
}

interface FileContent {
	fileName: string;
	contents: string;
}

async function getContentsFromFiles(uri: vscode.Uri): Promise<FileContent[]> {
	const stat = await vscode.workspace.fs.stat(uri);
	if (stat.type === vscode.FileType.Directory) {
		const files = await getFilenamesInDirectory(uri);
		const fileContents = await Promise.all(files.map((file) => getContentsFromFiles(file)));
		return fileContents.flat();
	} else {
		const contents = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
		return [{ fileName: uri.fsPath, contents }];
	}
}

export function deactivate() {}

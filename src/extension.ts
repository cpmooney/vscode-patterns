import * as vscode from 'vscode';
import { FileContent, FileContentInfo, getFileContentInfoFromUri, writeFileContentsToFiles } from './file-utilities';

export function activate(context: vscode.ExtensionContext) {
	const registerCommand = (command: string, callback: (...args: any[]) => any) => {
		context.subscriptions.push(vscode.commands.registerCommand(command, callback));
	};

	registerCommand('code-from-patterns.in-context-menu', async (uri: vscode.Uri) => {
		showInformationMessage(uri.path);
		const fileContentInfo = await getFileContentInfoFromUri(uri);
		vscode.commands.executeCommand('workbench.action.chat.open', 
			`@code-from-patterns ${JSON.stringify(fileContentInfo)}`
        );
	});

	vscode.chat.createChatParticipant("code-from-patterns-chat-participant-chat-particpant", async (request, _context, response, token) => {
		response.progress('Processing . . .');
		const chatModels = await vscode.lm.selectChatModels({ family: "gpt-4-turbo" });

		const { baseDirectory, fileContents } = JSON.parse(request.prompt) as FileContentInfo;

		const espanolResponse = await askCopilot(`Here are some files provided as JSON: ${JSON.stringify(fileContents)}.` +
		'Convert contents of files to spanish as well as file names without changing directory or extension.' +
		'Do not tell me how to do it -- do it for me.', chatModels[0], token);

		response.markdown("Done!");

		response.button({ title: 'Write to Files', command: 'write-to-file', arguments: [espanolResponse, baseDirectory] });
	});

	registerCommand('write-to-file', writeResponseToFiles);
}

const patternDirectoryLocation = "file:///Users/username/Documents/CodeFromPatterns/src/patterns/sdr-entity";

async function getFileContentInfoForPattern(): Promise<FileContentInfo> {
	return await getFileContentInfoFromUri(patternDirectoryLocation);
}

async function writeResponseToFiles(espanolResponse: string, baseDirectory: string) {
	const fileContents = findJsonInString<FileContent[]>(espanolResponse);
	writeFileContentsToFiles(fileContents, baseDirectory);
	openInEditorAndGiveFocus(baseDirectory);
}

async function askCopilot(message: string, chatModel: vscode.LanguageModelChat, token: vscode.CancellationToken): Promise<string> {
	const response = await chatModel.sendRequest([vscode.LanguageModelChatMessage.User(message)], undefined, token);
	return await getTextFromResponse(response);
}

function findJsonInString<T>(text: string): T {
    const regex = /```(?:json)?\n([\s\S]*?)\n```/;
	const jsonAsString = text.match(regex)?.[1] ?? '';
	return JSON.parse(jsonAsString) as T;
}

function openInEditorAndGiveFocus(filePath: string) {
	vscode.workspace.openTextDocument(filePath).then((doc) => {
		vscode.window.showTextDocument(doc, { preview: false });
	});
}

async function getTextFromResponse(response: vscode.LanguageModelChatResponse): Promise<string> {
	let data = '';
	for await (const token of response.text) {
		data += token;
	}
	return data;
}

function showInformationMessage(message: string) {
	vscode.window.showInformationMessage(message);
}

export function deactivate() {}

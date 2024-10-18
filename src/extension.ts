import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
	const registerCommand = (command: string, callback: (...args: any[]) => any) => {
		context.subscriptions.push(vscode.commands.registerCommand(command, callback));
	};

	vscode.chat.createChatParticipant("en-epsanol-chat-particpant", async (request, _context, response, token) => {
		response.progress('Gracias por tu paciencia . . .');

		const chatModels = await vscode.lm.selectChatModels({ family: "gpt-4-turbo" });

		const { baseDirectory, fileContents } = JSON.parse(request.prompt) as FileContentInfo;

		const espanolResponse = await askCopilot(`Here are some files provided as JSON: ${JSON.stringify(fileContents)}.` +
		'Convert contents of files to spanish as well as file names without changing directory or extension.' +
		'Do not tell me how to do it -- do it for me.', chatModels[0], token);

		response.markdown("Esta hecho!");

		response.button({ title: 'Escribir en el archivo', command: 'write-to-file', arguments: [espanolResponse, baseDirectory] });
	});

	registerCommand('write-to-file', writeResponseToFiles);
	registerCommand('enespanol.in-context-menu', async (uri: vscode.Uri) => {
		const fileContentInfo = await getFileContentInfoFromUri(uri);
		vscode.commands.executeCommand('workbench.action.chat.open', 
			`@enespanol ${JSON.stringify(fileContentInfo)}`
        );
	});
}

interface FileContentInfo {
	baseDirectory?: string;
	fileContents: FileContent[];
}

async function getFileContentInfoFromUri(uri: vscode.Uri): Promise<FileContentInfo> {
	const fileContents = await getContentsFromFiles(uri);
	const baseDirectory = await isDirectory(uri) ? path.relative(getRootPath(), uri.fsPath) : undefined;
	fileContents.forEach((fileContent) => {
		fileContent.fileName = path.relative(baseDirectory ?? '', fileContent.fileName);
	});
	return { baseDirectory, fileContents };
}

async function isDirectory(uri: vscode.Uri): Promise<boolean> {
	const stat = await vscode.workspace.fs.stat(uri);
	return stat.type === vscode.FileType.Directory;
}

async function getFilenamesInDirectory(uri: vscode.Uri): Promise<vscode.Uri[]> {
	if (!(await isDirectory(uri))) {
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

async function writeResponseToFiles(response: string, baseDirectory: string): Promise<void> {
	const fileContents = findJsonInString<FileContent[]>(response);
	await Promise.all(fileContents.map(({ fileName, contents }) => writeTextToFile(fileName, contents, baseDirectory)));
}

function findJsonInString<T>(text: string): T {
    const regex = /```(?:json)?\n([\s\S]*?)\n```/;
	const jsonAsString = text.match(regex)?.[1] ?? '';
	return JSON.parse(jsonAsString) as T;
}

function getRootPath(): string {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		throw new Error('No workspace folder is open.');
	}
	return workspaceFolders[0].uri.fsPath;
}

async function createNewDirectory(directoryName: string): Promise<string> {
	let absoluteDirectoryPath = path.join(getRootPath(), directoryName);
	let counter = 1;

	while (await directoryExists(absoluteDirectoryPath)) {
		absoluteDirectoryPath = path.join(getRootPath(), `${directoryName}-${counter}`);
		counter++;
	}

	await vscode.workspace.fs.createDirectory(vscode.Uri.file(absoluteDirectoryPath));
	vscode.window.showInformationMessage(`Directory ${path.basename(absoluteDirectoryPath)} created successfully.`);
	return path.relative(getRootPath(), absoluteDirectoryPath);
}

async function directoryExists(directoryPath: string): Promise<boolean> {
	try {
		const stat = await vscode.workspace.fs.stat(vscode.Uri.file(directoryPath));
		return stat.type === vscode.FileType.Directory;
	} catch {
		return false;
	}
}

async function writeTextToFile(filename: string, text: string, baseDirectory: string): Promise<void> {
	let absoluteFilename = '';
	if (baseDirectory) {
		const newDirectory = await createNewDirectory(baseDirectory);
		const rootDir = getRootPath();
		absoluteFilename = path.join(rootDir, newDirectory, filename);
	} else {
		absoluteFilename = path.join(getRootPath(), filename);
	}
    const fileUri = vscode.Uri.file(absoluteFilename);

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

	openInEditorAndGiveFocus(filename);
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
		return [await getContentsFromSingleFile(uri)];
	}
}

async function getContentsFromSingleFile(uri: vscode.Uri): Promise<FileContent> {
	const contents = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
	const fileName = path.relative(getRootPath(), uri.fsPath);
	return { fileName, contents };
}

export function deactivate() {}

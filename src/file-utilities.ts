import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const maxNumberOfFiles = 100;

export interface FileContent {
	fileName: string;
	contents: string;
}

export async function writeFileContentsToFiles(fileContents: FileContent[], baseDirectory: string): Promise<void> {
	await Promise.all(fileContents.map(({ fileName, contents }) => writeTextToFile(fileName, contents, baseDirectory)));
}

export function getFileContentInfoFromUri(uri: string): FileContent[] {
	const fileContents = getContentsFromFiles(uri);
	const baseDirectory = isDirectory(uri) ? path.relative(getRootPath(), uri) : undefined;
	return fileContents.map((fileContent) => ({
		...fileContent,
		fileName: path.relative(baseDirectory ?? '', fileContent.fileName)
	}));
}

export function getRootPath(): string {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		throw new Error('No workspace folder is open.');
	}
	return workspaceFolders[0].uri.fsPath;
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
    const encodedText = new TextEncoder().encode(text);

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

export function isDirectory(uri: string): boolean {
	return fs.statSync(uri).isDirectory();
}

function getFilenamesInDirectory(uri: string): string[] {
	if (!(isDirectory(uri))) {
		return [uri];
	}
    const files: fs.Dirent[] = fs.readdirSync(uri, { withFileTypes: true });
    const result: string[] = [];

    for (const file of files) {
        const fileUri = path.join(uri, file.name);
        if (file.isFile()) {
            result.push(fileUri);
        } else if (file.isDirectory()) {
            const subFiles = getFilenamesInDirectory(fileUri);
            result.push(...subFiles);
        }
    }

    return result;
}

function getContentsFromFiles(uri: string): FileContent[] {
	const stat = fs.statSync(uri);
	if (stat.isDirectory()) {
		const files = getFilenamesInDirectory(uri);
		if (files.length === 0) {
			const message = `Directory ${uri} is empty.`;
			vscode.window.showErrorMessage(message);
			throw new Error('Empty directory');
		}
		if (files.length > maxNumberOfFiles) {
			const message = `Directory ${uri} has ${files.length} files but the limit is ${maxNumberOfFiles}.`;
			vscode.window.showErrorMessage(message);
			throw new Error('Too many files');
		}
		const fileContents = files.map((file) => getContentsFromFiles(file));
		return fileContents.flat();
	} else {
		return [getContentsFromSingleFile(uri)];
	}
}

function getContentsFromSingleFile(uri: string): FileContent {
	const contents = fs.readFileSync(uri, 'utf8');
	const fileName = path.relative(getRootPath(), uri);
	return { fileName, contents };
}

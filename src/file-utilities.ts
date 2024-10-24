import * as vscode from 'vscode';
import * as path from 'path';

const maxNumberOfFiles = 100;

export interface FileContent {
	fileName: string;
	contents: string;
}

export async function writeFileContentsToFiles(fileContents: FileContent[], baseDirectory: string): Promise<void> {
	await Promise.all(fileContents.map(({ fileName, contents }) => writeTextToFile(fileName, contents, baseDirectory)));
}

export async function getFileContentInfoFromUri(uri: vscode.Uri): Promise<FileContent[]> {
	const fileContents = await getContentsFromFiles(uri);
	const baseDirectory = await isDirectory(uri) ? path.relative(getRootPath(), uri.fsPath) : undefined;
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

export async function isDirectory(uri: vscode.Uri): Promise<boolean> {
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

async function getContentsFromFiles(uri: vscode.Uri): Promise<FileContent[]> {
	const stat = await vscode.workspace.fs.stat(uri);
	if (stat.type === vscode.FileType.Directory) {
		const files = await getFilenamesInDirectory(uri);
		if (files.length > maxNumberOfFiles) {
			const message = `Directory ${uri.fsPath} has ${files.length} files but the limit is ${maxNumberOfFiles}.`;
			vscode.window.showErrorMessage(message);
			throw new Error('Too many files');
		}
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

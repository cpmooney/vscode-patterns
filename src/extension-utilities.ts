import * as vscode from 'vscode';

export const registerCommand = (context: vscode.ExtensionContext, command: string, callback: (...args: any[]) => any) => {
	context.subscriptions.push(vscode.commands.registerCommand(command, callback));
};

export type AskCopilot = (message: string) => Promise<string>;

export async function useAskCopilot(token: vscode.CancellationToken): Promise<AskCopilot> {
	const chatModels = await vscode.lm.selectChatModels({ family: "gpt-4-turbo" });
    return async (message: string): Promise<string> => {
        const response = await chatModels[0].sendRequest([vscode.LanguageModelChatMessage.User(message)], undefined, token);
        return await getTextFromResponse(response);
    };
}

async function getTextFromResponse(response: vscode.LanguageModelChatResponse): Promise<string> {
	let data = '';
	for await (const token of response.text) {
		data += token;
	}
	return data;
}

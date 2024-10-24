import * as vscode from 'vscode';
import { useAskCopilot } from './extension-utilities';
import { conversationHandler, registerCommands } from './conversation-handler';

export function activate(context: vscode.ExtensionContext) {
	registerCommands(context);

	vscode.chat.createChatParticipant("code-from-patterns-chat-participant-chat-particpant", async (request, _context, chatStream, token) => {
		const askCopilot = await useAskCopilot(token);
		conversationHandler(request.prompt, chatStream, askCopilot);
	});
}

export function deactivate() {}

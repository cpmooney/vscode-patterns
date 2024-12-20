import { FileContent } from "./file-utilities";

export const adaptToUseCase = (fileContents: FileContent[], useCaseDescription: string) =>
    `Here are some files provided as JSON: ${JSON.stringify(fileContents)}.` +
		`Adapt these files the following use case: ${useCaseDescription}` +
		'Do not tell me how to do it -- do it for me.' +
		'Response should be returned to be in json format in the same overall structure as I provided to you.';

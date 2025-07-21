import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const openAIApiKey = process.env.OPENAI_API_KEY;
const openAIModel = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

const llm = new ChatOpenAI({ openAIApiKey, modelName: openAIModel });

export async function generatePersonaReply(messages: [string, string][]): Promise<string> {
  const promptTemplate = ChatPromptTemplate.fromMessages(messages);
  const promptValue = await promptTemplate.invoke({});
  const response = await llm.invoke(promptValue);
  return response.content.toString();
}

const summaryPrompt = ChatPromptTemplate.fromMessages([
  ["system", "You are an expert in summarizing conversations. Create a concise, bullet-pointed summary of the following chat history. Focus on key questions, decisions, and outcomes."],
  ["user", "{history}"],
]);

export async function generateChatSummary(history: string): Promise<string> {
  const promptValue = await summaryPrompt.invoke({ history });
  const response = await llm.invoke(promptValue);
  return response.content.toString();
} 
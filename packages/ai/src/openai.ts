import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeText(text: string) {
  const chatCompletion = await openai.chat.completions.create({
    messages: [{
      role: 'user',
      content: `Analyze the following text and extract key information: ${text}`
    }],
    model: 'gpt-4o',
  });

  return chatCompletion.choices[0].message.content;
}

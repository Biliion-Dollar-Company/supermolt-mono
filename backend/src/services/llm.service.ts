
/**
 * LLM Service
 * Provides access to Large Language Models (Anthropic/OpenAI) 
 * for generating narrative-aware agent analysis.
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

interface LLMResponse {
    content: string;
    model: string;
    usage?: {
        input_tokens: number;
        output_tokens: number;
    };
}

export class LLMService {
    private static instance: LLMService;

    private constructor() { }

    public static getInstance(): LLMService {
        if (!LLMService.instance) {
            LLMService.instance = new LLMService();
        }
        return LLMService.instance;
    }

    public get isConfigured(): boolean {
        return !!(GROQ_API_KEY || ANTHROPIC_API_KEY || OPENAI_API_KEY);
    }

    /**
     * Generate text completion using available LLM
     */
    async generate(systemPrompt: string, userPrompt: string): Promise<string | null> {
        try {
            // Prioritize Groq (Cheaper/Faster)
            if (GROQ_API_KEY) {
                return this.callGroq(systemPrompt, userPrompt);
            }
            if (ANTHROPIC_API_KEY) {
                return this.callAnthropic(systemPrompt, userPrompt);
            }
            if (OPENAI_API_KEY) {
                return this.callOpenAI(systemPrompt, userPrompt);
            }
            return null;
        } catch (error) {
            console.error('LLM Generation Error:', error);
            return null;
        }
    }

    private async callGroq(system: string, user: string): Promise<string> {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile', // Intelligent & Fast (Latest)
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user },
                ],
                temperature: 0.7,
                max_tokens: 1024,
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Groq API Error: ${response.status} ${err}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    private async callAnthropic(system: string, user: string): Promise<string> {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': ANTHROPIC_API_KEY!,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307', // Fast & cheap for analysis
                max_tokens: 300,
                system: system,
                messages: [{ role: 'user', content: user }],
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Anthropic API Error: ${response.status} ${err}`);
        }

        const data = await response.json();
        return data.content[0].text;
    }

    private async callOpenAI(system: string, user: string): Promise<string> {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini', // Fast & cheap
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user },
                ],
                temperature: 0.7,
                max_tokens: 300,
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`OpenAI API Error: ${response.status} ${err}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }
}

export const llmService = LLMService.getInstance();

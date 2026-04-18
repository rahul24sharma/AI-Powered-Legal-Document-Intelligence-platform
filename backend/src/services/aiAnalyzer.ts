import 'dotenv/config';
// backend/src/services/aiAnalyzer.ts
import OpenAI from 'openai';

type AnalysisResponse = {
  riskScore: number;
  overallSummary: string;
  plainEnglish: string;
  keyTerms: string[];
  riskFactors: Array<{
    factor: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    explanation: string;
  }>;
  recommendations: Array<{
    category: string;
    suggestion: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
  clauses: Array<{
    type:
      | 'TERMINATION'
      | 'PAYMENT'
      | 'LIABILITY'
      | 'CONFIDENTIALITY'
      | 'INTELLECTUAL_PROPERTY'
      | 'DISPUTE_RESOLUTION'
      | 'FORCE_MAJEURE'
      | 'OTHER';
    content: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    explanation: string;
    suggestions: string[];
    position: { page: number; section: string };
  }>;
};

const openAiKey = process.env.OPENAI_API_KEY;
const hasLikelyOpenAiKey =
  !!openAiKey && !openAiKey.startsWith('sk-ant-') && !openAiKey.startsWith('claude-');

const openai = hasLikelyOpenAiKey
  ? new OpenAI({
      apiKey: openAiKey,
    })
  : null;

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
/** Default: local Ollama (open-source, no per-token billing). Set LLM_PROVIDER=openai|anthropic only if you opt in. */
const LLM_PROVIDER = (process.env.LLM_PROVIDER || 'ollama').toLowerCase();
const OLLAMA_MODEL = process.env.OLLAMA_LLM_MODEL || 'llama3.2:3b-instruct-q4_K_M';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const DOC_SNIPPET_CHARS = LLM_PROVIDER === 'ollama' ? 4000 : 6000;

// Enhanced analysis with context from similar documents
export async function analyzeDocumentWithContext(
  documentText: string,
  similarDocuments: any[] = []
) {
  let contextPrompt = '';

  if (similarDocuments.length > 0) {
    contextPrompt = `
CONTEXT: You have analyzed ${similarDocuments.length} similar documents before:

${similarDocuments.map((doc, i) => {
  const similarity = Math.round((doc.similarity || 0) * 100);
  return `
Similar Document ${i + 1} (${similarity}% similar):
- Type: ${doc.metadata?.documentType || 'Unknown'}
- File: ${doc.metadata?.fileName || 'Unknown'}
- Risk Score: ${doc.metadata?.riskScore || 'Not analyzed'}
- Key Issues: ${doc.metadata?.keyIssues?.join(', ') || 'None recorded'}
- Date: ${doc.metadata?.createdAt ? new Date(doc.metadata.createdAt).toLocaleDateString() : 'Unknown'}
`;
}).join('\n')}

IMPORTANT: 
- Compare this new document to the similar ones above
- Mention specific comparisons like "Unlike Document 1 which had X issue, this document..."
- If you see patterns, mention them: "Like your previous NDAs, this document also..."
- Be MORE SPECIFIC because you have context from similar documents
`;
  } else {
    contextPrompt = `
CONTEXT: This appears to be your first document of this type, so I'll provide a thorough baseline analysis.
`;
  }

  const analysisPrompt = `
${contextPrompt}

You are a legal document analysis expert. Analyze the following legal document and provide a comprehensive analysis.

IMPORTANT: Return ONLY a valid JSON object with no additional text, markdown formatting, or code blocks.

The JSON should have this exact structure:
{
  "riskScore": (number between 0-100),
  "overallSummary": "string",
  "plainEnglish": "string",
  "keyTerms": ["array", "of", "important", "terms"],
  "riskFactors": [
    {
      "factor": "string",
      "severity": "LOW|MEDIUM|HIGH|CRITICAL",
      "explanation": "string"
    }
  ],
  "recommendations": [
    {
      "category": "string",
      "suggestion": "string",
      "priority": "LOW|MEDIUM|HIGH"
    }
  ],
  "clauses": [
    {
      "type": "TERMINATION|PAYMENT|LIABILITY|CONFIDENTIALITY|INTELLECTUAL_PROPERTY|DISPUTE_RESOLUTION|FORCE_MAJEURE|OTHER",
      "content": "string",
      "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
      "explanation": "string",
      "suggestions": ["array", "of", "suggestions"],
      "position": {"page": 1, "section": "string"}
    }
  ]
}

Document to analyze:
${documentText.substring(0, DOC_SNIPPET_CHARS)}
`;

  try {
    console.log(`🤖 Sending analysis request via provider: ${LLM_PROVIDER}`);

    let analysisText = '';
    if (LLM_PROVIDER === 'ollama') {
      analysisText = await runOllamaAnalysis(analysisPrompt);
    } else if (LLM_PROVIDER === 'openai') {
      analysisText = await runOpenAIAnalysis(analysisPrompt);
    } else if (LLM_PROVIDER === 'anthropic') {
      analysisText = await runAnthropicAnalysis(analysisPrompt);
    } else if (LLM_PROVIDER === 'mock') {
      throw new Error('mock provider — use fallback');
    } else {
      throw new Error(`Unsupported LLM provider "${LLM_PROVIDER}"`);
    }

    if (!analysisText) throw new Error('Empty response from LLM provider');
    const rawAnalysis = parseAIResponse(analysisText);
    const validatedAnalysis = validateAnalysisResponse(rawAnalysis);
    console.log('✅ Successfully parsed AI analysis');
    return validatedAnalysis;
  } catch (error) {
    console.error('❌ LLM analysis error:', error);
    throw new Error('Document analysis failed');
  }
}

// Fallback standard analysis function
export async function analyzeDocument(documentText: string) {
  // Replace with simplified or basic prompt logic if needed
  return {
    riskScore: 50,
    overallSummary: "Basic analysis without similar context.",
    plainEnglish: "This is a default fallback summary.",
    keyTerms: [],
    riskFactors: [],
    recommendations: [],
    clauses: []
  };
}

async function runOpenAIAnalysis(prompt: string): Promise<string> {
  if (!openai) throw new Error('OPENAI_API_KEY missing');
  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You are a legal document analysis expert. Always respond with valid JSON only.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    max_tokens: 2200,
    temperature: 0.2,
  });
  return response.choices[0].message.content || '';
}

async function runAnthropicAnalysis(prompt: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1800,
      temperature: 0.2,
      system: 'You are a legal document analysis expert. Always respond with valid JSON only.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${t}`);
  }
  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = data.content?.find((c) => c.type === 'text')?.text || '';
  return text;
}

async function runOllamaAnalysis(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      format: 'json',
      stream: false,
      options: {
        temperature: 0.2,
        num_predict: 1400,
      },
      messages: [
        {
          role: 'system',
          content: 'You are a legal document analysis expert. Always respond with valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Ollama API error ${res.status}: ${t}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content || '';
}

function parseAIResponse(text: string): any {
  const cleaned = text.trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Could not parse JSON from AI response');
    return JSON.parse(match[0]);
  }
}

function validateAnalysisResponse(obj: any): AnalysisResponse {
  return {
    riskScore: Number.isFinite(obj?.riskScore) ? Math.max(0, Math.min(100, Number(obj.riskScore))) : 50,
    overallSummary: String(obj?.overallSummary || 'No summary generated.'),
    plainEnglish: String(obj?.plainEnglish || 'No plain-English summary generated.'),
    keyTerms: Array.isArray(obj?.keyTerms) ? obj.keyTerms.map(String).slice(0, 20) : [],
    riskFactors: Array.isArray(obj?.riskFactors)
      ? obj.riskFactors.map((r: any) => ({
          factor: String(r?.factor || 'General risk'),
          severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(r?.severity))
            ? r.severity
            : 'MEDIUM',
          explanation: String(r?.explanation || ''),
        }))
      : [],
    recommendations: Array.isArray(obj?.recommendations)
      ? obj.recommendations.map((r: any) => ({
          category: String(r?.category || 'General'),
          suggestion: String(r?.suggestion || ''),
          priority: ['LOW', 'MEDIUM', 'HIGH'].includes(String(r?.priority)) ? r.priority : 'MEDIUM',
        }))
      : [],
    clauses: Array.isArray(obj?.clauses)
      ? obj.clauses.map((c: any) => ({
          type: [
            'TERMINATION',
            'PAYMENT',
            'LIABILITY',
            'CONFIDENTIALITY',
            'INTELLECTUAL_PROPERTY',
            'DISPUTE_RESOLUTION',
            'FORCE_MAJEURE',
            'OTHER',
          ].includes(String(c?.type))
            ? c.type
            : 'OTHER',
          content: String(c?.content || ''),
          riskLevel: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(c?.riskLevel))
            ? c.riskLevel
            : 'MEDIUM',
          explanation: String(c?.explanation || ''),
          suggestions: Array.isArray(c?.suggestions) ? c.suggestions.map(String) : [],
          position: {
            page: Number.isFinite(c?.position?.page) ? Number(c.position.page) : 1,
            section: String(c?.position?.section || 'Unknown'),
          },
        }))
      : [],
  };
}

import 'dotenv/config';
// backend/src/services/aiAnalyzer.ts
import OpenAI from 'openai';
import { logger } from '../lib/logger';

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

const DOC_SNIPPET_CHARS = LLM_PROVIDER === 'ollama' ? 1800 : 3600;
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 8000);

// Enhanced analysis with context from similar documents
export async function analyzeDocumentWithContext(
  documentText: string,
  similarDocuments: any[] = []
) {
  const contextPrompt = buildContextPrompt(similarDocuments);

  const analysisPrompt = `
${contextPrompt}

You are a legal document analysis expert.
Return only JSON.
Focus on the most important risks and keep each field concise.

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
    logger.info(`Sending analysis request via provider: ${LLM_PROVIDER}`);

    let analysisText = '';
    if (LLM_PROVIDER === 'ollama') {
      analysisText = await runOllamaAnalysis(analysisPrompt, OLLAMA_TIMEOUT_MS);
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
    logger.debug('Successfully parsed AI analysis');
    return validatedAnalysis;
  } catch (error) {
    logger.warn('LLM analysis error:', error);
    logger.info('Falling back to fast heuristic analysis');
    return generateFastAnalysis(documentText, similarDocuments);
  }
}

// Fallback standard analysis function
export async function analyzeDocument(documentText: string) {
  return generateFastAnalysis(documentText);
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

async function runOllamaAnalysis(prompt: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      format: 'json',
      stream: false,
      options: {
        temperature: 0.2,
        num_predict: 700,
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
  clearTimeout(timeout);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Ollama API error ${res.status}: ${t}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content || '';
}

function buildContextPrompt(similarDocuments: any[]): string {
  if (similarDocuments.length === 0) {
    return `
CONTEXT: This appears to be your first document of this type, so provide a concise baseline analysis.
`;
  }

  const topDoc = similarDocuments.slice(0, 1);
  return `
CONTEXT: You have one similar precedent document for comparison:

${topDoc
  .map((doc, i) => {
    const similarity = Math.round((doc.similarity || 0) * 100);
    return `
Similar Document ${i + 1} (${similarity}% similar):
- Type: ${doc.metadata?.documentType || 'Unknown'}
- File: ${doc.metadata?.fileName || 'Unknown'}
- Risk Score: ${doc.metadata?.riskScore || 'Not analyzed'}
- Key Issues: ${doc.metadata?.keyIssues?.join(', ') || 'None recorded'}
`;
  })
  .join('\n')}

Compare this document only at a high level and keep the answer concise.
`;
}

function generateFastAnalysis(documentText: string, similarDocuments: any[] = []): AnalysisResponse {
  const text = documentText.toLowerCase();
  const base = similarDocuments.length > 0 ? 42 : 48;

  const riskSignals = [
    ['termination', 8],
    ['liability', 10],
    ['indemn', 10],
    ['confidential', 6],
    ['arbitration', 4],
    ['renewal', 4],
    ['auto-renew', 6],
    ['exclus', 5],
    ['penalty', 8],
    ['governing law', 3],
    ['payment', 4],
    ['late fee', 6],
    ['intellectual property', 7],
  ] as const;

  const matches = riskSignals.filter(([needle]) => text.includes(needle));
  const scoreBoost = matches.reduce((sum, [, points]) => sum + points, 0);
  const riskScore = Math.max(5, Math.min(92, base + scoreBoost));

  const keyTerms = Array.from(
    new Set(
      [
        ...matches.map(([needle]) => needle.replace(/-/g, ' ')),
        ...extractTopTerms(documentText, 6),
      ]
    )
  ).slice(0, 8);

  const riskFactors = buildRiskFactors(matches, similarDocuments.length > 0);
  const recommendations = buildRecommendations(matches);
  const clauses = buildClauses(text, riskScore);

  return {
    riskScore,
    overallSummary: similarDocuments.length > 0
      ? 'Fast review completed using local heuristics and precedent context. The document shows moderate legal risk and should be checked for the flagged clause areas.'
      : 'Fast review completed using local heuristics. The document appears manageable but should be checked for the flagged clause areas.',
    plainEnglish: 'This is a quick review designed for fast turnaround. It highlights the main risk areas so you can decide what to inspect first.',
    keyTerms,
    riskFactors,
    recommendations,
    clauses,
  };
}

function extractTopTerms(text: string, limit: number): string[] {
  const stopWords = new Set([
    'the', 'and', 'for', 'that', 'with', 'this', 'from', 'shall', 'will', 'have', 'has', 'you', 'your',
    'are', 'was', 'were', 'been', 'may', 'not', 'but', 'all', 'any', 'our', 'they', 'their', 'there',
    'such', 'between', 'agreement', 'contract', 'party', 'parties', 'document', 'section', 'terms',
  ]);

  const freq = new Map<string, number>();
  for (const raw of text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
    const token = raw.trim();
    if (!token || token.length < 4 || stopWords.has(token)) continue;
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token)
    .slice(0, limit);
}

function buildRiskFactors(
  matches: readonly (readonly [string, number])[],
  hasContext: boolean
): AnalysisResponse['riskFactors'] {
  const factors: AnalysisResponse['riskFactors'] = matches.slice(0, 4).map(([needle]) => ({
    factor: needle === 'indemn' ? 'Indemnity exposure' : needle.replace(/-/g, ' '),
    severity: needle === 'liability' || needle === 'indemn' ? 'HIGH' : 'MEDIUM',
    explanation: `The document contains language related to ${needle.replace(/-/g, ' ')}, which can increase negotiation or compliance risk.`,
  }));

  if (factors.length === 0) {
    factors.push({
      factor: hasContext ? 'Comparable to prior reviewed documents' : 'Standard commercial terms',
      severity: 'MEDIUM' as const,
      explanation: 'No obvious red-flag terms were detected, but the document still deserves a legal review before signing.',
    });
  }

  return factors;
}

function buildRecommendations(
  matches: readonly (readonly [string, number])[]
): AnalysisResponse['recommendations'] {
  const recommendations: AnalysisResponse['recommendations'] = [
    {
      category: 'Review',
      suggestion: 'Confirm the most important obligations and termination terms before signing.',
      priority: 'HIGH' as const,
    },
  ];

  if (matches.some(([needle]) => needle === 'liability' || needle === 'indemn')) {
    recommendations.push({
      category: 'Negotiation',
      suggestion: 'Limit liability exposure and confirm indemnity language with counsel.',
      priority: 'HIGH' as const,
    });
  }

  if (matches.some(([needle]) => needle === 'payment' || needle === 'late fee')) {
    recommendations.push({
      category: 'Finance',
      suggestion: 'Double-check payment timing, late fees, and any automatic renewal language.',
      priority: 'MEDIUM' as const,
    });
  }

  return recommendations.slice(0, 3);
}

function buildClauses(text: string, riskScore: number): AnalysisResponse['clauses'] {
  const clauseHints = [
    { type: 'CONFIDENTIALITY' as const, keywords: ['confidential', 'non-disclosure', 'nda'] },
    { type: 'LIABILITY' as const, keywords: ['liability', 'indemn', 'damages'] },
    { type: 'PAYMENT' as const, keywords: ['payment', 'fee', 'invoice', 'late fee'] },
    { type: 'TERMINATION' as const, keywords: ['termination', 'terminate', 'renewal'] },
    { type: 'INTELLECTUAL_PROPERTY' as const, keywords: ['intellectual property', 'ownership', 'license'] },
  ];

  return clauseHints
    .filter((clause) => clause.keywords.some((keyword) => text.includes(keyword)))
    .slice(0, 4)
    .map((clause, index) => ({
      type: clause.type,
      content: `Fast review detected likely ${clause.type.toLowerCase().replace(/_/g, ' ')} language.`,
      riskLevel: (riskScore >= 70 && index === 0 ? 'HIGH' : 'MEDIUM') as AnalysisResponse['clauses'][number]['riskLevel'],
      explanation: 'This clause area usually needs a closer legal review before approval.',
      suggestions: [
        'Confirm the business owner for this clause',
        'Check whether the language is negotiable',
      ],
      position: { page: 1, section: clause.type.replace(/_/g, ' ') },
    }));
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

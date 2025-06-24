// backend/src/services/aiAnalyzer.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
${documentText.substring(0, 6000)}
`;

  try {
    console.log('🤖 Sending enhanced request to OpenAI with context...');

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a legal document analysis expert. Always respond with valid JSON only."
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      max_tokens: 2500,
      temperature: 0.3
    });

    const analysisText = response.choices[0].message.content;
    console.log('🤖 Enhanced AI response received');

    if (!analysisText) throw new Error('Empty response from OpenAI');

    const rawAnalysis = parseAIResponse(analysisText);
    const validatedAnalysis = validateAnalysisResponse(rawAnalysis);
    console.log('✅ Successfully parsed enhanced AI analysis with context');
    return validatedAnalysis;

  } catch (error) {
    console.error('❌ Enhanced OpenAI API error:', error);
    console.log('🔄 Falling back to standard analysis...');
    return await analyzeDocument(documentText);
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

// Dummy functions to be replaced by your actual parser/validator logic
function parseAIResponse(text: string): any {
  return JSON.parse(text);
}

function validateAnalysisResponse(obj: any): any {
  return obj;
}

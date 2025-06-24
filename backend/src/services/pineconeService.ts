// backend/src/services/pineconeService.ts
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'legal-documents';

// Initialize Pinecone index
export async function initializePinecone() {
  try {
    const index = pinecone.index(INDEX_NAME);
    console.log('✅ Pinecone initialized successfully');
    return index;
  } catch (error) {
    console.error('❌ Failed to initialize Pinecone:', error);
    throw error;
  }
}

// Create embedding for text
export async function createEmbedding(text: string): Promise<number[]> {
  try {
    console.log('📊 Creating embedding with OpenAI...');
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small", // Reliable OpenAI model
      input: text.substring(0, 8000), // Limit text length
      dimensions: 1024 // Match your Pinecone index
    });
    
    console.log(`✅ Created embedding with ${response.data[0].embedding.length} dimensions`);
    return response.data[0].embedding;
  } catch (error) {
    console.error('❌ Failed to create embedding:', error);
    throw error;
  }
}

// Store document in Pinecone
export async function storeDocumentEmbedding(
  documentId: string,
  documentText: string,
  metadata: {
    userId: string;
    documentType: string;
    fileName: string;
    riskScore?: number;
    keyIssues?: string[];
    organizationId?: string;
  }
) {
  try {
    console.log('💾 Storing document embedding in Pinecone...');
    
    const index = await initializePinecone();
    const embedding = await createEmbedding(documentText);
    
    await index.upsert([{
      id: documentId,
      values: embedding,
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
        textPreview: documentText.substring(0, 200) + '...'
      }
    }]);
    
    console.log(`✅ Document ${documentId} stored in Pinecone`);
  } catch (error) {
    console.error('❌ Failed to store document embedding:', error);
    // Don't throw - embedding storage is optional
  }
}

// Find similar documents
export async function findSimilarDocuments(
  documentText: string,
  userId: string,
  topK: number = 5
) {
  try {
    console.log('🔍 Finding similar documents...');

    const index = await initializePinecone();
    const embedding = await createEmbedding(documentText);

    const results = await index.query({
      vector: embedding,
      topK,
      includeMetadata: true,
      filter: {
        userId: userId
      }
    });

    console.log(`✅ Found ${results.matches?.length || 0} similar documents`);

    return (results.matches || []).map(match => ({
      id: match.id,
      similarity: match.score || 0,
      metadata: match.metadata
    }));
  } catch (error: any) {
    console.error('❌ Failed to find similar documents:', error?.message || error);
    return [];
  }
}


// Find similar clauses
export async function findSimilarClauses(
  clauseText: string,
  clauseType: string,
  userId: string,
  topK: number = 5
) {
  try {
    console.log('🔍 Finding similar clauses...');
    
    const index = await initializePinecone();
    const embedding = await createEmbedding(clauseText);
    
    const results = await index.query({
      vector: embedding,
      topK,
      includeMetadata: true,
      filter: {
        userId: userId,
        type: 'clause',
        clauseType: clauseType
      }
    });
    
    return results.matches.map(match => ({
      id: match.id,
      similarity: match.score || 0,
      content: match.metadata?.content,
      riskLevel: match.metadata?.riskLevel,
      suggestions: match.metadata?.suggestions
    }));
  } catch (error) {
    console.error('❌ Failed to find similar clauses:', error);
    return [];
  }
}

// Store individual clauses for better similarity matching
export async function storeClauseEmbeddings(
  documentId: string,
  clauses: any[],
  userId: string
) {
  try {
    console.log('💾 Storing clause embeddings...');
    
    const index = await initializePinecone();
    const vectors = [];
    
    for (let i = 0; i < clauses.length; i++) {
      const clause = clauses[i];
      const embedding = await createEmbedding(clause.content);
      
      vectors.push({
        id: `${documentId}-clause-${i}`,
        values: embedding,
        metadata: {
          type: 'clause',
          documentId,
          userId,
          clauseType: clause.type,
          content: clause.content,
          riskLevel: clause.riskLevel,
          suggestions: clause.suggestions,
          explanation: clause.explanation
        }
      });
    }
    
    if (vectors.length > 0) {
      await index.upsert(vectors);
      console.log(`✅ Stored ${vectors.length} clause embeddings`);
    }
  } catch (error) {
    console.error('❌ Failed to store clause embeddings:', error);
  }
}

// Detect document type from content
export function detectDocumentType(text: string): string {
  const content = text.toLowerCase();
  
  if (content.includes('non-disclosure') || content.includes('confidentiality')) {
    return 'NDA';
  } else if (content.includes('employment') || content.includes('job') || content.includes('salary')) {
    return 'Employment Contract';
  } else if (content.includes('service') && content.includes('agreement')) {
    return 'Service Agreement';
  } else if (content.includes('lease') || content.includes('rental')) {
    return 'Lease Agreement';
  } else if (content.includes('purchase') || content.includes('sale')) {
    return 'Purchase Agreement';
  } else if (content.includes('license')) {
    return 'License Agreement';
  } else {
    return 'Legal Document';
  }
}

// Update document with analysis results
export async function updateDocumentWithAnalysis(
  documentId: string,
  analysis: any
) {
  try {
    console.log('🔄 Updating document with analysis results...');

    const index = await initializePinecone();

    await index.update({
      id: documentId,
      metadata: {
        riskScore: analysis.riskScore,
        keyIssues: analysis.riskFactors?.map((rf: any) => rf.factor) || [],
        analyzed: true,
        analysisDate: new Date().toISOString()
      }
    });

    console.log(`✅ Updated document ${documentId} with analysis`);
  } catch (error: any) {
    console.error('❌ Failed to update document:', error?.message || error);
  }
}

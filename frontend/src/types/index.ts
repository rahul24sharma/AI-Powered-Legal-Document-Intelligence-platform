export interface User {
    id: string;
    email: string;
    name: string;
    role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  }
  
  export interface Document {
    id: string;
    filename: string;
    originalName: string;
    fileUrl?: string;
    downloadUrl?: string | null;
    fileSize: number;
    mimeType: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    createdAt: string;
    analysis?: Analysis;
  }
  
  export interface Analysis {
    id: string;
    riskScore: number;
    overallSummary: string;
    plainEnglish: string;
    keyTerms: string[];
    riskFactors: RiskFactor[];
    recommendations: Recommendation[];
    clauses: Clause[];
  }
  
  export interface RiskFactor {
    factor: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    explanation: string;
  }
  
  export interface Recommendation {
    category: string;
    suggestion: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
  }
  
  export interface Clause {
    id: string;
    type: string;
    content: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    explanation: string;
    suggestions: string[];
  }

export interface SimilarDocumentScoreBreakdown {
  vector: number;
  keyword: number;
  recency: number;
  hybridRank: number;
}

export interface SimilarDocument extends Document {
  relevanceScore: number;
  similarity: number;
  scoreBreakdown: SimilarDocumentScoreBreakdown;
  rankingMethod: string;
}

export interface SimilarDocumentsPayload {
  similarDocuments: SimilarDocument[];
  count: number;
  ranking?: {
    retrievalTopK: number;
    responseLimit: number;
    method: string;
  };
}

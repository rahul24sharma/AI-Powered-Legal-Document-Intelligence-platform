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
    fileSize: number;
    mimeType: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
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
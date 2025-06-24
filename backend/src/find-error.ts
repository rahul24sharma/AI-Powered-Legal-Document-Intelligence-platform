// src/find-error.ts
import express from 'express';

const app = express();

console.log('Testing basic express setup...');

// Test 1: Basic route
try {
  app.get('/test', (req, res) => {
    res.json({ message: 'test works' });
  });
  console.log('✅ Basic route works');
} catch (error) {
  console.error('❌ Basic route failed:', error);
  process.exit(1);
}

// Test 2: Try to load auth routes
console.log('Testing auth routes...');
try {
  const authRouter = express.Router();
  
  // Test each route individually
  authRouter.post('/register', (req, res) => {
    res.json({ message: 'register route' });
  });
  console.log('✅ Auth register route created');
  
  authRouter.post('/login', (req, res) => {
    res.json({ message: 'login route' });
  });
  console.log('✅ Auth login route created');
  
  app.use('/api/auth', authRouter);
  console.log('✅ Auth router mounted');
} catch (error) {
  console.error('❌ Auth routes failed:', error);
  process.exit(1);
}

// Test 3: Try document routes
console.log('Testing document routes...');
try {
  const docRouter = express.Router();
  
  docRouter.get('/', (req, res) => {
    res.json({ message: 'documents list' });
  });
  console.log('✅ Documents list route created');
  
  docRouter.get('/:id', (req, res) => {
    res.json({ message: 'document detail', id: req.params.id });
  });
  console.log('✅ Document detail route created');
  
  app.use('/api/documents', docRouter);
  console.log('✅ Document router mounted');
} catch (error) {
  console.error('❌ Document routes failed:', error);
  process.exit(1);
}

// Test 4: Try upload routes
console.log('Testing upload routes...');
try {
  const uploadRouter = express.Router();
  
  uploadRouter.post('/', (req, res) => {
    res.json({ message: 'upload route' });
  });
  console.log('✅ Upload route created');
  
  app.use('/api/upload', uploadRouter);
  console.log('✅ Upload router mounted');
} catch (error) {
  console.error('❌ Upload routes failed:', error);
  process.exit(1);
}

const PORT = 5001; // Different port to avoid conflicts

app.listen(PORT, () => {
  console.log('🎉 ALL TESTS PASSED!');
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log('The basic routing works fine.');
  console.log('\n🔍 The issue is likely in your imported files:');
  console.log('- Check src/services/documentProcessor.ts');
  console.log('- Check src/services/aiAnalyzer.ts');
  console.log('- Check src/middleware/auth.ts');
  
  process.exit(0);
});
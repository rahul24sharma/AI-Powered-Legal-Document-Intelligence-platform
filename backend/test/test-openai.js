require('dotenv').config();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testOpenAI() {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Hello! This is a test." }],
      max_tokens: 50,
    });
    
    console.log('✅ OpenAI API works!');
    console.log('Response:', response.choices[0].message.content);
  } catch (error) {
    console.error('❌ OpenAI API error:', error.message);
  }
}

testOpenAI();
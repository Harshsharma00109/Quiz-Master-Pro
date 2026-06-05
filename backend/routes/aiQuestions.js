const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/generate-questions', async (req, res) => {
  const { topic, difficulty = 'medium', count = 5 } = req.body;

  if (!topic) return res.status(400).json({ error: 'Topic is required' });

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
    Generate ${count} multiple choice quiz questions about "${topic}".
    Difficulty level: ${difficulty}

    Return ONLY a valid JSON array, no extra text, no markdown, no backticks:
    [
      {
        "question_text": "Your question here?",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correct_answer": 0,
        "explanation": "Why this answer is correct",
        "points": 10
      }
    ]

    Rules:
    - correct_answer is the INDEX (0, 1, 2, or 3)
    - Make all 4 options realistic
    - easy = basic knowledge
    - medium = some thinking required  
    - hard = tricky and detailed
    - Keep questions clear and accurate
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Clean response
    const clean = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const questions = JSON.parse(clean);

    res.json({ success: true, questions, topic, difficulty, count: questions.length });

  } catch (err) {
    console.error('Gemini error:', err.message);
    res.status(500).json({ error: 'Failed to generate questions', details: err.message });
  }
});

module.exports = router;
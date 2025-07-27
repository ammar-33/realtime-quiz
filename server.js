
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const Quiz = require('./models/Quiz');

const fetch = require('node-fetch');

const HUGGING_FACE_API_KEY = process.env.HUGGING_FACE_API_KEY || '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';


const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

mongoose.connect('mongodb://localhost:27017/quiz', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY environment variable is not set.');
} else {
  console.log('OPENAI_API_KEY is set.');
}

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// REST API
app.post('/api/quizzes', async (req, res) => {
  try {
    const quiz = new Quiz(req.body);
    await quiz.save();
    res.json(quiz);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/generate-questions', async (req, res) => {
  const { topic, count } = req.body;
  if (!topic || !count) {
    return res.status(400).json({ error: 'Missing topic or count' });
  }
  try {
    console.log('Using OpenAI API for question generation:', topic, count);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that generates quiz questions.',
        },
        {
          role: 'user',
          content: `Generate ${count} quiz questions about "${topic}". Each question should have 4 options and indicate the correct answer index. Format as JSON array with keys: question, options, answer.`,
        },
      ],
    });
    const responseText = completion.choices[0].message.content;
    console.log('OpenAI generated text:', responseText);

    const jsonMatch = responseText.match(/\[.*\]/s);
    if (!jsonMatch) {
      console.error('Failed to extract JSON from OpenAI response:', responseText);
      return res.status(500).json({ error: 'Failed to extract JSON from AI response' });
    }
    let questions;
    try {
      questions = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('Failed to parse OpenAI response JSON:', e, responseText);
      return res.status(500).json({ error: 'Failed to parse AI response JSON' });
    }
    res.json({ questions });
  } catch (err) {
    console.error('Error in /api/generate-questions:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/quizzes', async (req, res) => {
  const quizzes = await Quiz.find();
  res.json(quizzes);
});

app.get('/api/quizzes/:id', async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  res.json(quiz);
});

app.get('/api/search-quizzes', async (req, res) => {
  const { q } = req.query;
  const quizzes = await Quiz.find({
    $or: [
      { title: { $regex: q, $options: 'i' } },
      { category: { $regex: q, $options: 'i' } }
    ]
  });
  res.json(quizzes);
});

// Real-time logic
let rooms = {};

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomId, username, profilePic }) => {
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push({ id: socket.id, username, profilePic, score: 0 });
    io.to(roomId).emit('userList', rooms[roomId]);
  });

  socket.on('startQuiz', ({ roomId, quiz }) => {
    rooms[roomId].quiz = quiz;
    io.to(roomId).emit('quizStarted', quiz);
  });

  socket.on('setQuiz', ({ roomId, quiz }) => {
    rooms[roomId].quiz = quiz;
  });

  socket.on('submitAnswer', ({ roomId, username, questionIndex, answerIndex }) => {
    const quiz = rooms[roomId].quiz;
    let user = rooms[roomId].find(u => u.username === username);
    if (quiz && quiz.questions[questionIndex].answer.includes(answerIndex)) {
      user.score += 1;
    }
    io.to(roomId).emit('answerSubmitted', { username, answerIndex, score: user.score });
  });

  socket.on('chatMessage', ({ roomId, username, msg }) => {
    io.to(roomId).emit('chatMessage', { username, msg });
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter(u => u.id !== socket.id);
      io.to(roomId).emit('userList', rooms[roomId]);
    }
  });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));

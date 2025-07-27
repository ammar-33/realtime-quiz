const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  title: String,
  category: String,
  questions: [{
    question: String,
    options: [String],
    answer: [Number], // support multiple correct answers
    timeLimit: { type: Number, default: 15 }
  }]
});

module.exports = mongoose.model('Quiz', quizSchema);
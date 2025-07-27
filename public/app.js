const socket = io();

let roomId, username;
let playerEmoji = '😀';
const emojiOptions = ['😀', '😎', '🤖', '👾', '🐱', '🐶', '🦄', '🍕', '🚀'];

function createRoom() {
  roomId = document.getElementById('newRoomId').value.trim();
  if (!roomId) return alert('Enter a room name!');
  document.getElementById('create-room-section').style.display = 'none';
  document.getElementById('join-section').style.display = 'none';
}

function joinRoom() {
  roomId = document.getElementById('roomId').value;
  username = document.getElementById('username').value;
  if (!roomId || !username) return alert('Enter Room ID and Name!');
  socket.emit('joinRoom', { roomId, username, emoji: playerEmoji });
  document.getElementById('join-section').style.display = 'none';
  document.getElementById('create-room-section').style.display = 'none';
  updatePlayerNav();
}

function updatePlayerNav() {
  const nameInput = document.getElementById('player-name-input');
  const emojiPicker = document.getElementById('emoji-picker');
  if (nameInput && emojiPicker) {
    nameInput.value = username || '';
    emojiPicker.textContent = playerEmoji;
  }
}

function cycleEmoji() {
  const currentIndex = emojiOptions.indexOf(playerEmoji);
  const nextIndex = (currentIndex + 1) % emojiOptions.length;
  playerEmoji = emojiOptions[nextIndex];
  const emojiPicker = document.getElementById('emoji-picker');
  if (emojiPicker) {
    emojiPicker.textContent = playerEmoji;
  }
  socket.emit('updatePlayerEmoji', { roomId, username, emoji: playerEmoji });
}

function onPlayerNameChange(e) {
  const newName = e.target.value.trim();
  if (newName.length > 0) {
    username = newName;
    socket.emit('updatePlayerName', { roomId, username, emoji: playerEmoji });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('player-name-input');
  const emojiPicker = document.getElementById('emoji-picker');
  const playerNavIcon = document.getElementById('player-nav-icon');
  const playerDropdown = document.getElementById('player-dropdown');
  const playerDropdownClose = document.getElementById('player-dropdown-close');

  if (nameInput) {
    nameInput.addEventListener('change', onPlayerNameChange);
  }
  if (emojiPicker) {
    emojiPicker.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val.length > 0) {
        playerEmoji = val;
        socket.emit('updatePlayerEmoji', { roomId, username, emoji: playerEmoji });
      }
    });
  }
  if (playerNavIcon && playerDropdown) {
    playerNavIcon.addEventListener('click', () => {
      playerDropdown.classList.remove('close');
      playerDropdown.classList.add('open');
      playerDropdown.style.display = 'flex';
    });
  }
  if (playerDropdownClose && playerDropdown) {
    playerDropdownClose.addEventListener('click', () => {
      playerDropdown.classList.remove('open');
      playerDropdown.classList.add('close');
      setTimeout(() => {
        playerDropdown.style.display = 'none';
      }, 300);
    });
  }
  updatePlayerNav();
});

// AI question generation feature

const aiTopicInput = document.getElementById('aiTopic');
const questionCountInput = document.getElementById('questionCount');
const questionCountValue = document.getElementById('questionCountValue');

if (questionCountInput && questionCountValue) {
  questionCountInput.addEventListener('input', () => {
    questionCountValue.textContent = questionCountInput.value;
  });
}

async function generateAIQuestions() {
  const topic = document.getElementById('aiTopic').value.trim();
  const count = parseInt(document.getElementById('questionCount').value, 10);
  if (!topic) {
    alert('Please enter a topic for AI question generation.');
    return;
  }
  if (isNaN(count) || count < 1) {
    alert('Please select a valid number of questions.');
    return;
  }
  try {
    const response = await fetch('/api/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, count }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      alert('Error generating questions: ' + (errorData.error || response.statusText));
      return;
    }
    const data = await response.json();
    if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
      alert('No questions generated.');
      return;
    }
    // Use the generated questions to start the quiz
    const quiz = {
      title: `AI Generated Quiz on "${topic}"`,
      category: topic,
      questions: data.questions,
    };
    // Emit socket event to start quiz with generated questions
    socket.emit('setQuiz', { roomId, quiz });
    socket.emit('startQuiz', { roomId, quiz });
    alert(`Generated ${data.questions.length} questions. Quiz started!`);
  } catch (err) {
    alert('Error generating questions: ' + err.message);
  }
}

// Existing functions below...

function submitAnswer(idx) {
  socket.emit('submitAnswer', { roomId, username, questionIndex: currentQuestion, answerIndex: idx });
}

socket.on('answerSubmitted', ({ username: user, answerIndex, score }) => {
  if (user === username) {
    myScore = score;
    let correct = quiz.questions[currentQuestion].answer[0];
    let msg = answerIndex === correct ? "Correct!" : `Wrong! Correct answer: ${quiz.questions[currentQuestion].options[correct]}`;
    document.getElementById('score').innerText = `Your Score: ${myScore} | ${msg}`;
    currentQuestion++;
    setTimeout(showQuestion, 2000);
  }
});

// ... rest of the existing code unchanged

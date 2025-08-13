import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import CorrectAnswers from './CorrectAnswers';

const QuizPanel = ({ isOpen, videoId, onClose, onSystemMessage }) => {
  const [isFetchingQuiz, setIsFetchingQuiz] = useState(false);
  const [quizData, setQuizData] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [quizComplete, setQuizComplete] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(false);

  const quizContainerRef = useRef(null);

  // Fetch quiz when opened
  useEffect(() => {
    if (!isOpen || !videoId) return;

    let isCancelled = false;
    async function fetchQuiz() {
      setIsFetchingQuiz(true);
      setQuizData([]);
      setUserAnswers({});
      setCurrentQuestionIndex(0);
      setQuizComplete(false);
      setShowCorrectAnswers(false);

      try {
        const resp = await axios.post('http://localhost:8000/api/quiz/generate', {
          video_id: videoId
        });
        if (isCancelled) return;
        const questions = Array.isArray(resp.data?.quiz) ? resp.data.quiz : [];
        setQuizData(questions);
      } catch (error) {
        console.error('Error fetching quiz:', error);
        if (!isCancelled && onSystemMessage) {
          onSystemMessage({
            id: Date.now(),
            sender: 'system',
            text: `Failed to load quiz: ${error.message || 'Unknown error'}`,
            isError: true
          });
        }
        if (onClose) onClose();
      } finally {
        if (!isCancelled) setIsFetchingQuiz(false);
      }
    }

    fetchQuiz();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, videoId, onClose, onSystemMessage]);

  // Auto-scroll panel into view when open or question changes
  useEffect(() => {
    if (isOpen && quizContainerRef.current) {
      quizContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isOpen, currentQuestionIndex]);

  if (!isOpen) return null;

  const currentQuestion = quizData[currentQuestionIndex];

  const handleSelectAnswer = (optionText) => {
    if (!currentQuestion) return;
    setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: optionText }));
  };

  const handleNextQuestion = () => {
    if (!currentQuestion) return;
    const answered = userAnswers[currentQuestion.id];
    if (!answered) return;

    if (currentQuestionIndex < quizData.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      let score = 0;
      for (const q of quizData) {
        if (userAnswers[q.id] === q.answer) score += 1;
      }
      setQuizScore(score);
      setQuizComplete(true);
    }
  };

  return (
    <div ref={quizContainerRef} className="mt-4 bg-gray-900 rounded-xl border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold">Quiz</h3>
        <button
          onClick={onClose}
          className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded"
        >
          Close
        </button>
      </div>
      {isFetchingQuiz ? (
        <div className="text-gray-300">Fetching quiz...</div>
      ) : quizData.length === 0 ? (
        <div className="text-gray-400">No quiz available.</div>
      ) : !quizComplete ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white font-semibold">Question {currentQuestionIndex + 1} of {quizData.length}</h4>
            <span className="text-xs text-gray-400 capitalize">Difficulty: {currentQuestion?.difficulty}</span>
          </div>
          <div className="text-white text-lg mb-3">{currentQuestion?.question}</div>
          <div className="space-y-2">
            {currentQuestion?.options?.map((opt, i) => {
              const checked = userAnswers[currentQuestion.id] === opt;
              return (
                <label key={i} className={`flex items-center p-3 rounded-lg cursor-pointer border ${checked ? 'border-indigo-500 bg-indigo-900 bg-opacity-30' : 'border-gray-700 hover:bg-gray-800'}`}>
                  <input
                    type="radio"
                    name={`q-${currentQuestion.id}`}
                    className="mr-2"
                    checked={checked}
                    onChange={() => handleSelectAnswer(opt)}
                  />
                  <span className="text-gray-200">{opt}</span>
                </label>
              );
            })}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleNextQuestion}
              disabled={!userAnswers[currentQuestion.id]}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg"
            >
              {currentQuestionIndex === quizData.length - 1 ? 'Submit' : 'Next'}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between">
            <h4 className="text-white font-semibold">Quiz Complete</h4>
            <span className="text-gray-300">Score: {quizScore} / {quizData.length}</span>
          </div>
          <div className="mt-3">
            <button
              onClick={() => setShowCorrectAnswers(!showCorrectAnswers)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg"
            >
              {showCorrectAnswers ? 'Hide Correct Answers' : 'Show Correct Answers'}
            </button>
            {showCorrectAnswers && (
              <CorrectAnswers quiz={quizData} userAnswers={userAnswers} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizPanel;



import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import CorrectAnswers from './CorrectAnswers';
import { API_URL } from './utils.jsx'; // Import API_URL for consistency

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
      console.log('Fetching quiz for video ID:', videoId);
      setIsFetchingQuiz(true);
      setQuizData([]);
      setUserAnswers({});
      setCurrentQuestionIndex(0);
      setQuizComplete(false);
      setQuizScore(0);
      setShowCorrectAnswers(false);

      try {
        // Use the same API_URL pattern as the main component
        const apiUrl = API_URL;
        console.log('Making API call to:', `${apiUrl}/api/quiz/generate`);
        
        const resp = await axios.post(`${apiUrl}/api/quiz/generate`, {
          video_id: videoId
        }, {
          // Removed timeout completely - let it take as long as needed
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true' // Add ngrok header for consistency
          }
        });
        
        console.log('Quiz API response:', resp.data);
        console.log('Response type:', typeof resp.data);
        console.log('Response keys:', Object.keys(resp.data || {}));
        console.log('Quiz data type:', typeof resp.data?.quiz);
        console.log('Quiz data:', resp.data?.quiz);
        
        if (isCancelled) return;
        
        // Process the response immediately before checking cancellation again
        const questions = Array.isArray(resp.data?.quiz) ? resp.data.quiz : [];
        console.log('Parsed questions:', questions);
        console.log('Questions length:', questions.length);
        console.log('First question:', questions[0]);
        
        if (questions.length === 0) {
          throw new Error('No quiz questions received from the server');
        }
        
        // Set the quiz data immediately
        setQuizData(questions);
        
        // Send success message
        if (onSystemMessage) {
          onSystemMessage({
            id: Date.now(),
            sender: 'system',
            text: `Quiz loaded successfully! ${questions.length} questions ready.`,
            isError: false
          });
        }
        
      } catch (error) {
        console.error('Error fetching quiz:', error);
        
        let errorMessage = 'Failed to load quiz';
        
        if (error.response) {
          // Server responded with error status
          console.error('Server error response:', error.response.data);
          errorMessage = error.response.data?.message || error.response.data?.error || `Server error: ${error.response.status}`;
        } else if (error.request) {
          // Request was made but no response received
          console.error('Network error:', error.request);
          errorMessage = 'Network error - unable to reach quiz server';
        } else {
          // Something else happened
          errorMessage = error.message || 'Unknown error occurred';
        }
        
        if (!isCancelled && onSystemMessage) {
          onSystemMessage({
            id: Date.now(),
            sender: 'system',
            text: errorMessage,
            isError: true
          });
        }
        
        // Close the quiz panel on error
        if (!isCancelled && onClose) {
          setTimeout(() => onClose(), 2000); // Close after 2 seconds to show error
        }
        
      } finally {
        if (!isCancelled) {
          setIsFetchingQuiz(false);
        }
      }
    }

    fetchQuiz();
    
    return () => {
      console.log('Cancelling quiz fetch');
      isCancelled = true;
    };
  }, [isOpen, videoId]); // Remove onClose and onSystemMessage from dependencies

  // Auto-scroll panel into view when open or question changes
  useEffect(() => {
    if (isOpen && quizContainerRef.current) {
      quizContainerRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start',
        inline: 'nearest'
      });
    }
  }, [isOpen, currentQuestionIndex]);

  if (!isOpen) return null;

  const currentQuestion = quizData[currentQuestionIndex];

  const handleSelectAnswer = (optionText) => {
    if (!currentQuestion) return;
    console.log('Answer selected:', optionText, 'for question:', currentQuestion.id);
    setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: optionText }));
  };

  const handleNextQuestion = () => {
    if (!currentQuestion) return;
    
    const answered = userAnswers[currentQuestion.id];
    if (!answered) {
      console.log('No answer selected for current question');
      return;
    }

    console.log('Moving to next question. Current index:', currentQuestionIndex);

    if (currentQuestionIndex < quizData.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Calculate final score
      let score = 0;
      for (const q of quizData) {
        if (userAnswers[q.id] === q.answer) {
          score += 1;
        }
      }
      console.log('Quiz completed. Final score:', score, 'out of', quizData.length);
      
      setQuizScore(score);
      setQuizComplete(true);
      
      // Send completion message
      if (onSystemMessage) {
        onSystemMessage({
          id: Date.now(),
          sender: 'system',
          text: `Quiz completed! You scored ${score} out of ${quizData.length} questions.`,
          isError: false
        });
      }
    }
  };

  const handleRestartQuiz = () => {
    console.log('Restarting quiz');
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setQuizComplete(false);
    setQuizScore(0);
    setShowCorrectAnswers(false);
  };

  return (
    <div ref={quizContainerRef} className="mt-4 bg-gray-900 rounded-xl border border-gray-800 p-4 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-lg flex items-center">
          <span className="text-2xl mr-2">🧠</span>
          Quiz
        </h3>
        <button
          onClick={onClose}
          className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
        >
          Close
        </button>
      </div>

      {isFetchingQuiz ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mr-3"></div>
          <span className="text-gray-300">Loading quiz questions...</span>
        </div>
      ) : quizData.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 text-lg mb-2">No quiz available</div>
          <div className="text-gray-500 text-sm">
            Unable to generate quiz questions for this video.
          </div>
        </div>
      ) : !quizComplete ? (
        <div className="space-y-4">
          {/* Progress bar */}
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / quizData.length) * 100}%` }}
            ></div>
          </div>
          
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white font-semibold">
              Question {currentQuestionIndex + 1} of {quizData.length}
            </h4>
            {currentQuestion?.difficulty && (
              <span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-300 capitalize">
                {currentQuestion.difficulty}
              </span>
            )}
          </div>
          
          <div className="text-white text-lg mb-4 leading-relaxed">
            {currentQuestion?.question}
          </div>
          
          <div className="space-y-3">
            {currentQuestion?.options?.map((opt, i) => {
              const checked = userAnswers[currentQuestion.id] === opt;
              return (
                <label 
                  key={i} 
                  className={`flex items-start p-4 rounded-lg cursor-pointer border transition-all duration-200 ${
                    checked 
                      ? 'border-indigo-500 bg-indigo-900 bg-opacity-40 shadow-lg' 
                      : 'border-gray-700 hover:bg-gray-800 hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${currentQuestion.id}`}
                    className="mt-1 mr-3 text-indigo-500 focus:ring-indigo-500"
                    checked={checked}
                    onChange={() => handleSelectAnswer(opt)}
                  />
                  <span className="text-gray-200 leading-relaxed">{opt}</span>
                </label>
              );
            })}
          </div>
          
          <div className="flex justify-between items-center mt-6">
            <button
              onClick={handleRestartQuiz}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
            >
              Restart Quiz
            </button>
            <button
              onClick={handleNextQuestion}
              disabled={!userAnswers[currentQuestion?.id]}
              className="px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 font-semibold"
            >
              {currentQuestionIndex === quizData.length - 1 ? 'Submit Quiz' : 'Next Question'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center py-6">
            <div className="text-4xl mb-4">
              {quizScore === quizData.length ? '🎉' : quizScore >= quizData.length * 0.7 ? '👏' : '📚'}
            </div>
            <h4 className="text-white font-bold text-xl mb-2">Quiz Complete!</h4>
            <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 mb-4">
              Score: {quizScore} / {quizData.length}
            </div>
            <div className="text-gray-300">
              {quizScore === quizData.length 
                ? 'Perfect score! Excellent work!' 
                : quizScore >= quizData.length * 0.7 
                ? 'Great job! You understand the content well.' 
                : 'Good effort! Consider reviewing the material.'}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setShowCorrectAnswers(!showCorrectAnswers)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              {showCorrectAnswers ? 'Hide Answers' : 'Show Correct Answers'}
            </button>
            <button
              onClick={handleRestartQuiz}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-lg transition-all duration-200"
            >
              Retake Quiz
            </button>
          </div>
          
          {showCorrectAnswers && (
            <CorrectAnswers quiz={quizData} userAnswers={userAnswers} />
          )}
        </div>
      )}
    </div>
  );
};

export default QuizPanel;
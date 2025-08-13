import React from 'react';

const CorrectAnswers = ({ quiz, userAnswers }) => {
  if (!Array.isArray(quiz) || quiz.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-4">
      {quiz.map((q, idx) => {
        const userAnswer = userAnswers?.[q.id];
        const isCorrect = userAnswer === q.answer;
        return (
          <div key={q.id || idx} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-start justify-between mb-2">
              <h4 className="text-white font-semibold">Q{idx + 1}. {q.question}</h4>
              <span className={`text-xs px-2 py-1 rounded ${isCorrect ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                {isCorrect ? 'Correct' : 'Incorrect'}
              </span>
            </div>
            <div className="text-sm">
              <div className="text-gray-300">
                <span className="font-medium text-gray-400">Your answer:</span> {userAnswer ?? '—'}
              </div>
              <div className="text-gray-300 mt-1">
                <span className="font-medium text-gray-400">Correct answer:</span> {q.answer}
              </div>
              {q.explanation && (
                <div className="text-gray-400 mt-2">
                  <span className="font-medium text-gray-500">Explanation:</span> {q.explanation}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CorrectAnswers;



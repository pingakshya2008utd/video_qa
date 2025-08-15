// src/components/HomePage.jsx
import { useState } from 'react';
import { 
  MessageSquare, 
  Globe, 
  Brain, 
  Video, 
  User, 
  LogOut, 
  BookOpen,
  Award,
  Lightbulb,
  ArrowRight,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const HomePage = ({ onNavigateToChat, onNavigateToTranslate }) => {
  const { currentUser, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  const features = [
    {
      icon: MessageSquare,
      title: "Chat with Videos",
      description: "Upload YouTube videos and have intelligent conversations about the content. Ask questions, get summaries, and understand complex topics better.",
      action: "Start Video Chat",
      onClick: onNavigateToChat,
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      icon: Brain,
      title: "AI Doubt Solver",
      description: "Get instant answers to your academic questions. Our AI tutor can help with math, science, literature, and more subjects.",
      action: "Ask a Question",
      onClick: () => console.log("Navigate to doubt solver"),
      gradient: "from-purple-500 to-pink-500"
    },
    {
      icon: Award,
      title: "Interactive Quizzes",
      description: "Test your knowledge with AI-generated quizzes. Adaptive difficulty levels ensure you're always challenged at the right level.",
      action: "Take a Quiz",
      onClick: () => console.log("Navigate to quiz"),
      gradient: "from-green-500 to-emerald-500"
    },
    {
      icon: Globe,
      title: "Smart Translation",
      description: "Translate text between languages with context awareness. Perfect for learning new languages and understanding foreign content.",
      action: "Start Translating",
      onClick: onNavigateToTranslate,
      gradient: "from-orange-500 to-red-500"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <img 
                src="/logo-new.png" 
                alt="VidyaAI Logo" 
                className="h-12 w-auto mr-4"
              />
              <div>
                <h1 className="text-2xl font-bold text-white">VidyaAI</h1>
                <p className="text-sm text-gray-400">Your AI Learning Companion</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                  {currentUser?.photoURL ? (
                    <img 
                      src={currentUser.photoURL} 
                      alt="Profile" 
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <User size={18} className="text-white" />
                  )}
                </div>
                <div>
                  <p className="text-white font-medium">
                    {currentUser?.displayName || 'User'}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {currentUser?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <LogOut size={18} className="mr-2" />
                Logout
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="md:hidden border-t border-gray-800 py-4">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                  {currentUser?.photoURL ? (
                    <img 
                      src={currentUser.photoURL} 
                      alt="Profile" 
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <User size={20} className="text-white" />
                  )}
                </div>
                <div>
                  <p className="text-white font-medium">
                    {currentUser?.displayName || 'User'}
                  </p>
                  <p className="text-gray-400 text-sm">
                    {currentUser?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <LogOut size={18} className="mr-2" />
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Welcome to Your AI Learning Hub
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Unlock the power of AI-driven education. Chat with videos, solve doubts instantly, 
            take adaptive quizzes, and translate content seamlessly.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div
                key={index}
                className="group bg-gray-900 rounded-2xl p-8 border border-gray-800 hover:border-gray-700 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10"
              >
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-r ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <IconComponent size={28} className="text-white" />
                </div>
                
                <h3 className="text-2xl font-bold text-white mb-4">
                  {feature.title}
                </h3>
                
                <p className="text-gray-400 leading-relaxed mb-6">
                  {feature.description}
                </p>
                
                <button
                  onClick={feature.onClick}
                  className={`group/btn inline-flex items-center px-6 py-3 bg-gradient-to-r ${feature.gradient} text-white font-medium rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105`}
                >
                  {feature.action}
                  <ArrowRight size={18} className="ml-2 group-hover/btn:translate-x-1 transition-transform duration-300" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Stats Section */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video size={32} className="text-white" />
              </div>
              <h3 className="text-3xl font-bold text-white mb-2">1000+</h3>
              <p className="text-gray-400">Videos Analyzed</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lightbulb size={32} className="text-white" />
              </div>
              <h3 className="text-3xl font-bold text-white mb-2">5000+</h3>
              <p className="text-gray-400">Doubts Solved</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen size={32} className="text-white" />
              </div>
              <h3 className="text-3xl font-bold text-white mb-2">10000+</h3>
              <p className="text-gray-400">Quiz Questions</p>
            </div>
          </div>
        </div>

        {/* Quick Start Section */}
        <div className="mt-16 text-center">
          <h3 className="text-3xl font-bold text-white mb-8">Ready to Start Learning?</h3>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onNavigateToChat}
              className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 hover:scale-105 shadow-lg"
            >
              <MessageSquare size={20} className="mr-2" />
              Chat with a Video
            </button>
            <button
              onClick={onNavigateToTranslate}
              className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold rounded-xl hover:from-orange-700 hover:to-red-700 transition-all duration-300 hover:scale-105 shadow-lg"
            >
              <Globe size={20} className="mr-2" />
              Translate Content
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-400">
            <p>&copy; 2024 VidyaAI. Empowering education through artificial intelligence.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
import React from 'react';
import Navbar from '../components/layout/Navbar';
import Silk from '../components/common/Silk';
import { Mic, Radio, Bot, Save } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function About() {
  const { isDark } = useTheme();

  return (
    <div className="min-h-screen relative bg-black overflow-hidden">
      {/* Silk Background - Covers entire page */}
      {/* Dark base layer */}
      <div className="fixed inset-0 w-full h-full bg-linear-to-br from-black via-blue-950 to-slate-950 pointer-events-none z-0"></div>
      
      {/* Primary Silk layer - Bright Blue */}
      <div className="fixed inset-0 w-full h-full pointer-events-none opacity-60 z-0">
        <Silk
          speed={8}
          scale={1.5}
          color="#3B82F6"
          noiseIntensity={0.7}
          rotation={0.3}
        />
      </div>
      
      {/* Secondary Silk layer - Deep Blue for depth */}
      <div className="fixed inset-0 w-full h-full pointer-events-none opacity-50 z-0">
        <Silk
          speed={10}
          scale={1.2}
          color="#1E40AF"
          noiseIntensity={0.6}
          rotation={-0.2}
        />
      </div>
      
      {/* Tertiary Silk layer - Black accent for contrast */}
      <div className="fixed inset-0 w-full h-full pointer-events-none opacity-35 z-0">
        <Silk
          speed={7}
          scale={0.9}
          color="#0F172A"
          noiseIntensity={0.5}
          rotation={0.15}
        />
      </div>

      {/* Content wrapper - positioned above background */}
      <div className="relative z-10 min-h-screen">
        <Navbar />
        
        {/* How It Works Section */}
        <section id="how-it-works" className="py-24 md:py-32 px-6 sm:px-8 md:px-12 transition-colors duration-300">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16 md:mb-20">
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-black mb-6 leading-tight text-white drop-shadow-lg">
                How NeuroLex Works
              </h2>
              <p className="text-lg md:text-xl text-gray-100 max-w-2xl mx-auto drop-shadow-md">
                Three-step detection pipeline
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card 1 - Audio Recording */}
              <div className="relative group p-8 rounded-3xl transition-all duration-300 bg-linear-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-md hover:scale-105 shadow-2xl border border-gray-700/50">
                <div className="text-center mb-6">
                  <div className="text-7xl font-black text-white/90 mb-3">01</div>
                  <div className="flex justify-center mb-4">
                    <Mic className="w-16 h-16 text-blue-400" />
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-3 text-white text-center">
                  Audio Recording
                </h3>
                <div className="text-xs leading-relaxed text-gray-300 space-y-1.5">
                  <p>• Record Audio (Web Audio API)</p>
                  <p>• Convert to Text (Web Speech API) - REAL-TIME!</p>
                  <p>• Send text chunks to backend every 5-10 seconds</p>
                </div>
              </div>
              
              {/* Card 2 - Communication */}
              <div className="relative group p-8 rounded-3xl transition-all duration-300 bg-linear-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-md hover:scale-105 shadow-2xl border border-gray-700/50">
                <div className="text-center mb-6">
                  <div className="text-7xl font-black text-white/90 mb-3">02</div>
                  <div className="flex justify-center mb-4">
                    <Radio className="w-16 h-16 text-purple-400" />
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-3 text-white text-center">
                  Real-time Transfer
                </h3>
                <div className="text-xs leading-relaxed text-gray-300 space-y-1.5">
                  <p>• WebSocket or HTTP POST</p>
                  <p>• Real-time text chunks transmission</p>
                  <p>• Continuous data streaming</p>
                </div>
              </div>
              
              {/* Card 3 - Backend */}
              <div className="relative group p-8 rounded-3xl transition-all duration-300 bg-linear-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-md hover:scale-105 shadow-2xl border border-gray-700/50">
                <div className="text-center mb-6">
                  <div className="text-7xl font-black text-white/90 mb-3">03</div>
                  <div className="flex justify-center mb-4">
                    <Bot className="w-16 h-16 text-green-400" />
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-3 text-white text-center">
                  Backend Processing
                </h3>
                <div className="text-xs leading-relaxed text-gray-300 space-y-1.5">
                  <p>• Receive Text Chunk → Process with Gemini</p>
                  <p>✓ Simplify to Simple English</p>
                  <p>✓ Generate Step-by-Step Explanation</p>
                </div>
              </div>
              
              {/* Card 4 - Export and Save */}
              <div className="relative group p-8 rounded-3xl transition-all duration-300 bg-linear-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-md hover:scale-105 shadow-2xl border border-gray-700/50">
                <div className="text-center mb-6">
                  <div className="text-7xl font-black text-white/90 mb-3">04</div>
                  <div className="flex justify-center mb-4">
                    <Save className="w-16 h-16 text-orange-400" />
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-3 text-white text-center">
                  Export and Save
                </h3>
                <div className="text-xs leading-relaxed text-gray-300 space-y-1.5">
                  <p>• Save to Firestore</p>
                  <p>• Frontend listens in real-time</p>
                  <p>• Instant updates and synchronization</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className={`${isDark ? 'bg-gray-950' : 'bg-gray-900'} text-white py-12 md:py-16 px-6 sm:px-8 md:px-12 transition-colors duration-300`}>
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12 mb-12">
              {/* Brand */}
              <div>
                <h3 className="text-2xl font-black mb-4">NeuroLex</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Making education accessible for everyone, one lecture at a time.
                </p>
              </div>
              
              {/* Links */}
              <div>
                <h4 className="font-bold mb-4 text-lg">Product</h4>
                <ul className="space-y-2 text-gray-400 text-sm">
                  <li><a href="#" className="hover:text-white transition">Features</a></li>
                  <li><a href="#" className="hover:text-white transition">Pricing</a></li>
                  <li><a href="#" className="hover:text-white transition">Security</a></li>
                </ul>
              </div>
              
              {/* Company */}
              <div>
                <h4 className="font-bold mb-4 text-lg">Company</h4>
                <ul className="space-y-2 text-gray-400 text-sm">
                  <li><a href="#" className="hover:text-white transition">About</a></li>
                  <li><a href="#" className="hover:text-white transition">Blog</a></li>
                  <li><a href="#" className="hover:text-white transition">Contact</a></li>
                </ul>
              </div>
              
              {/* Team */}
              <div>
                <h4 className="font-bold mb-4 text-lg">About the Team</h4>
                <ul className="space-y-2 text-gray-400 text-sm">
                  <li><span className="text-white font-medium">Pushkar Deshpande</span> - Lead Developer</li>
                  <li><span className="text-white font-medium">Harsh Singh</span> - UI/UX Designer</li>
                  <li><span className="text-white font-medium">Code Lunatics</span> - Team</li>
                </ul>
              </div>
            </div>
            
            <div className={`border-t ${isDark ? 'border-gray-800' : 'border-gray-800'} pt-8 text-center text-gray-400 text-sm`}>
              <p>Made with ❤️ by Code Lunatics • NeuroLex © 2024. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

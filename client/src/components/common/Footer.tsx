import React from 'react';
import { Link } from 'react-router-dom';
import { Layers, Globe, GitFork, Heart, Code2, PenTool } from 'lucide-react';

export const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-800 bg-slate-950/80 backdrop-blur-md mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Top section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <Link to="/dashboard" className="flex items-center gap-2.5 text-slate-100 font-bold text-lg group w-fit">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                CollabSpace
              </span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
              Real-time collaborative code editor and whiteboard. Code together, create together.
            </p>
            {/* Social links */}
            <div className="flex items-center gap-3 mt-1">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="GitHub"
              >
                <GitFork className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Features */}
          <div>
            <h3 className="text-xs font-semibold tracking-wider uppercase text-slate-500 mb-4">Features</h3>
            <ul className="space-y-2.5">
              <li>
                <span className="flex items-center gap-2 text-sm text-slate-400">
                  <Code2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  Real-Time Code Editor
                </span>
              </li>
              <li>
                <span className="flex items-center gap-2 text-sm text-slate-400">
                  <PenTool className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  Collaborative Whiteboard
                </span>
              </li>
              <li>
                <span className="flex items-center gap-2 text-sm text-slate-400">
                  <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  Live Presence &amp; Chat
                </span>
              </li>
              <li>
                <span className="flex items-center gap-2 text-sm text-slate-400">
                  <Code2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  Version History
                </span>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs font-semibold tracking-wider uppercase text-slate-500 mb-4">Quick Links</h3>
            <ul className="space-y-2.5">
              <li>
                <Link
                  to="/dashboard"
                  className="text-sm text-slate-400 hover:text-indigo-400 transition-colors"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  to="/profile"
                  className="text-sm text-slate-400 hover:text-indigo-400 transition-colors"
                >
                  Profile Settings
                </Link>
              </li>
              <li>
                <Link
                  to="/login"
                  className="text-sm text-slate-400 hover:text-indigo-400 transition-colors"
                >
                  Sign In
                </Link>
              </li>
              <li>
                <Link
                  to="/register"
                  className="text-sm text-slate-400 hover:text-indigo-400 transition-colors"
                >
                  Create Account
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-800/60" />

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6">
          <p className="text-xs text-slate-500">
            &copy; {year} CollabSpace. All rights reserved.
          </p>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            Built by Mahzil Sohail using React, Socket.IO &amp; TypeScript
          </p>
        </div>
      </div>
    </footer>
  );
};

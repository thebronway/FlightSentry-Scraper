'use client';

import { Coffee, Github, Globe } from 'lucide-react';
import packageInfo from '../../package.json';

export function Footer() {
  return (
    <footer className="mt-auto py-6 border-t border-gunmetal-border bg-gunmetal-nav transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between text-sm text-gunmetal-muted">
        <div className="mb-4 md:mb-0 flex flex-col items-center md:items-start text-center md:text-left gap-1">
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/thebronway/FlightSentry-Scraper/blob/main/CHANGELOG.md"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors font-medium"
            >
              FlightSentry Scraper
            </a>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gunmetal-canvas border border-gunmetal-border text-gunmetal-muted">
              v{packageInfo.version}
            </span>
          </div>
          <span className="text-xs text-gunmetal-muted">
            Headless Chromium Engine
          </span>
          <span className="text-xs text-gunmetal-muted">
            Isolated Google Flights REST Bridge{' '}
            <code className="px-1.5 py-0.5 rounded bg-gunmetal-canvas border border-gunmetal-border text-slate-300">
              /api/v1
            </code>
          </span>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-3">
          <a
            href="https://brian.conway.im/"
            target="_blank"
            rel="noopener noreferrer"
            title="Developer's Website & Projects"
            className="hover:text-emerald-500 transition-colors flex items-center gap-1.5 font-medium"
          >
            <Globe className="w-4 h-4" />
            <span>Developer&apos;s Website</span>
          </a>
          <a
            href="https://github.com/thebronway/FlightSentry-Scraper/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-purple-500 transition-colors flex items-center gap-1.5 font-medium"
          >
            <Github className="w-4 h-4" />
            <span>Report An Issue</span>
          </a>
          <a
            href="https://buymeacoffee.com/brianconway"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-yellow-500 transition-colors flex items-center gap-1.5 font-medium"
          >
            <Coffee className="w-4 h-4" />
            <span>Support FlightSentry</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
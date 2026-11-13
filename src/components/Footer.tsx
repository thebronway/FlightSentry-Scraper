'use client';

export function Footer() {
  return (
    <footer className="bg-gunmetal-nav border-t border-gunmetal-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gunmetal-muted">
        <span>FlightSentry Scraper Microservice • Headless Chromium Engine</span>
        <span>Isolated Google Flights REST Bridge (/api/v1)</span>
      </div>
    </footer>
  );
}
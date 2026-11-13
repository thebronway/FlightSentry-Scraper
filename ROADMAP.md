# FlightSentry-Scraper Roadmap

*Last updated: 2026-11-13*  
*Current Version: v0.1.5*

## Overview
This document tracks planned improvements, enhancements, and technical debt for FlightSentry-Scraper

## Release Roadmap

### Release v0.1.5: UI updates / fixes
- Brand alignment
    - Header 
        - Remove version, keep evverything else
        - Update font and sizes to match main app
    - Footer
        - Update font and sizes to match main app
        - Keep current content, maybe add a second line?
        - Add version but mkeep the bubble format, I like that. 
    - Quota
        - Color(s) alignment
    - Scraper Guardrails & Proxy Section
        - Tooltips for all Scraper Guardrails & Proxy
            - Use same ones from main app
        - Add use/restore defaults to Scraper Guardrails & Proxy
        - Put Serial FIFO Queue (Concurrency = 1) in the Scraper Guardrails & Proxy section, not in quota
    - Make sure branding aligns with main app
        - Like text size
- Remove extra adjectives like Armed, should ready not be adequte?

- Below are files from the main app to use as reference ONLY.

### Release v0.2.0: UX fixes
- API Keys
    - View individual usage per API key (simple like total, last day, last hour maybe?)
    - View overall usage
    - After revoke, can we delete them?
    - copy button not working after creating, text is not highlighted, maybe thats the issue

### Release v0.2.5: Banners
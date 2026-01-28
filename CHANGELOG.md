# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-01-27

### Added
- Initial release of Tako Research Canvas
- LangGraph agent with CopilotKit integration
- Tako MCP server integration for data visualization
- Tavily integration for web search
- Resource management with save/restore functionality
- Interactive iframe rendering for charts and visualizations
- MIT License

### Fixed
- Resource flickering on updates (#20)
- Iframe reloading by rendering outside ReactMarkdown tree (#18)
- Iframe visualization processing (#15)
- Whitespace beneath charts (#13)
- 410 error handling with session retry (#8, #14)
- Tako MCP URL handling (#6)
- Vercel deployment configuration (#2)

### Changed
- Switch to Tako MCP server for data sources (#5)
- Use Tavily content summary instead of full webpage (#7)
- More aggressive chart injection (#12)
- Code and documentation cleanup (#9)

[Unreleased]: https://github.com/TakoData/tako-copilotkit/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/TakoData/tako-copilotkit/releases/tag/v0.1.0

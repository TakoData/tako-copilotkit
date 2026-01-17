import { useCoAgent } from "@copilotkit/react-core";
import { TakoResearchState, TakoResource } from "../lib/types";

export function TakoResources() {
  const { state } = useCoAgent<TakoResearchState>({
    name: "tako_research_agent",
  });

  const resources = state?.resources || [];

  if (resources.length === 0) {
    return (
      <div className="p-6 text-center text-gray-400 dark:text-gray-600">
        <svg
          className="w-12 h-12 mx-auto mb-3 opacity-50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <p className="text-sm">No Tako charts yet</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
        Resources ({resources.length})
      </h2>
      <div className="space-y-4">
        {resources.map((resource) => (
          <ResourceCard key={resource.card_id} resource={resource} />
        ))}
      </div>
    </div>
  );
}

function ResourceCard({ resource }: { resource: TakoResource }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
          {resource.title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          {resource.description}
        </p>
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            Source: {resource.source}
          </span>
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            View on Tako
          </a>
        </div>
      </div>

      {/* Chart Iframe */}
      {resource.iframe_html && (
        <div
          className="w-full bg-gray-50 dark:bg-gray-900"
          dangerouslySetInnerHTML={{ __html: resource.iframe_html }}
        />
      )}
    </div>
  );
}

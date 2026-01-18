"use client";

import { ModelSelector } from "./ModelSelector";
import { useState } from "react";

interface InputProps {
  inProgress: boolean;
  onSend: (message: string) => Promise<void>;
  chatReady?: boolean;
  onStop?: () => void;
  hideStopButton?: boolean;
}

export function ChatInputWithModelSelector({
  inProgress,
  onSend,
  chatReady,
  onStop,
  hideStopButton,
}: InputProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !inProgress) {
      await onSend(message);
      setMessage("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
      <div className="border border-gray-300 rounded-xl focus-within:ring-2 focus-within:ring-[#6766FC] focus-within:border-transparent bg-white shadow-sm transition-all duration-200">
        {/* First row: Text input */}
        <div className="px-4 pt-3">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={inProgress || !chatReady}
            className="w-full text-base outline-none disabled:bg-white disabled:text-gray-400 placeholder:text-gray-400"
          />
        </div>

        {/* Second row: Model selector and Send button */}
        <div className="px-4 pb-3 pt-2 flex items-center justify-between gap-3">
          <div className="flex-shrink-0">
            <ModelSelector />
          </div>

          <div className="flex-shrink-0">
            {!inProgress ? (
              <button
                type="submit"
                disabled={!message.trim() || !chatReady}
                className="px-5 py-2 bg-[#6766FC] text-white rounded-lg hover:bg-[#5555eb] disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-sm transition-colors duration-200 shadow-sm"
              >
                Send
              </button>
            ) : (
              !hideStopButton &&
              onStop && (
                <button
                  type="button"
                  onClick={onStop}
                  className="px-5 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium text-sm transition-colors duration-200 shadow-sm"
                >
                  Stop
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </form>
  );
}

export interface AIAnalysisResult<T = any> {
  success: boolean;
  data?: T;
  warning?: string;
  error?: string;
}

export const handleAIResponse = <T>(response: any): AIAnalysisResult<T> => {
  if (!response) {
    return {
      success: false,
      warning: "AI analysis failed. Please enter data manually.",
    };
  }

  if (response.error) {
    return {
      success: false,
      warning: "AI analysis encountered an error. Please enter data manually.",
      error: response.error,
    };
  }

  return {
    success: true,
    data: response.data || response,
  };
};

export const withAIFallback = async <T>(
  aiFunction: () => Promise<T>,
  fallbackData?: Partial<T>
): Promise<AIAnalysisResult<T>> => {
  try {
    const result = await aiFunction();
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.warn("AI function failed:", error);
    return {
      success: false,
      data: fallbackData as T,
      warning: "AI analysis failed. Using fallback data or manual entry required.",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
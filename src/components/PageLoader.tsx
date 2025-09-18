import { Loader2 } from "lucide-react";

interface PageLoaderProps {
  text?: string;
}

export const PageLoader = ({ text = "Loading..." }: PageLoaderProps) => {
  return (
    <div className="flex min-h-[400px] w-full flex-col items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
};

export default PageLoader;
import { Card, CardContent } from "@/components/ui/card";

interface MessageCardProps {
  type: "error" | "success";
  message: string;
}

export function MessageCard({ type, message }: MessageCardProps) {
  const isError = type === "error";
  const borderColor = isError ? "border-destructive" : "border-green-500";
  const textColor = isError ? "text-destructive" : "text-green-600";
  const icon = isError ? "⚠️" : "✓";

  return (
    <Card className={borderColor}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-2">
          <span className={textColor}>{icon}</span>
          <p className={`text-sm ${textColor}`}>{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}


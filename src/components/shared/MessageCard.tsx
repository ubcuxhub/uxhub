import { Card, CardContent } from "@/components/ui/card";

interface MessageCardProps {
  type: "error" | "success";
  message: string;
}

export function MessageCard({ type, message }: MessageCardProps) {
  const isError = type === "error";
  const borderColor = isError ? "border-destructive" : "border-success";
  const textColor = isError ? "text-destructive" : "text-success";
  const icon = isError ? "⚠️" : "✓";

  return (
    <Card className={borderColor}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-2">
          <span className={textColor}>{icon}</span>
          <p className={`text-small ${textColor}`}>{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}

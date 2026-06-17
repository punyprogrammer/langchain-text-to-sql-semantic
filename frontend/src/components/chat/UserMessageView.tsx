interface UserMessageViewProps {
  content: string;
}

export function UserMessageView({ content }: UserMessageViewProps) {
  return (
    <div className="flex justify-end">
      <div className="max-w-2xl rounded-2xl rounded-tr-md bg-brand px-4 py-3 text-sm font-medium text-surface-100">
        {content}
      </div>
    </div>
  );
}

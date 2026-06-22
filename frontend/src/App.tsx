import { AppLayout } from "./components/layout/AppLayout";
import { ChatPage } from "./components/chat/ChatPage";
import { DataQualityPage } from "./components/data-quality/DataQualityPage";
import { useUiStore } from "./store/uiStore";

export default function App() {
  const activeView = useUiStore((state) => state.activeView);

  return (
    <AppLayout>
      {activeView === "chat" ? <ChatPage /> : <DataQualityPage />}
    </AppLayout>
  );
}

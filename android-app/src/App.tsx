import { FlaskConical } from "lucide-react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AndroidExperimentEditor } from "@android/components/AndroidExperimentEditor";
import { AndroidExperimentList } from "@android/components/AndroidExperimentList";

export function App() {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-white">
            <FlaskConical size={22} />
          </span>
          <div>
            <strong>实验速记</strong>
            <p className="text-xs text-muted">Android 本地 SQLite 版</p>
          </div>
        </div>
      </header>
      <Routes>
        <Route element={<Navigate replace to="/experiments" />} path="/" />
        <Route element={<AndroidExperimentList />} path="/experiments" />
        <Route element={<AndroidExperimentEditor />} path="/experiments/:id" />
      </Routes>
    </>
  );
}

import ProtectedRoute from "@/components/ProtectedRoute";
import Sidebar from "@/components/Sidebar";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminLayout({ children }) {
  const usuario = await getCurrentUser();

  return (
    <ProtectedRoute>
      {/* Backdrop tenue: da "materia" detrás del glass (sobre blanco plano el
          efecto muere). Glow cobre arriba-der + charcoal abajo-izq, opacity 0.06. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.06]"
        style={{
          background:
            "radial-gradient(circle at 85% 15%, rgba(35,41,46,0.5) 0, transparent 45%)," +
            "radial-gradient(circle at 15% 85%, rgba(35,41,46,0.5) 0, transparent 45%)",
        }}
      />
      <div className="flex min-h-screen bg-bg-app">
        <Sidebar usuario={usuario} />
        <main className="flex-1 min-w-0 px-4 md:px-8 pt-16 md:pt-8 pb-8">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}

import { Outlet } from 'react-router';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';

/**
 * Каркас приложения: AppHeader сверху (sticky), BottomNav снизу (fixed),
 * контент-слот с нижним паддингом 80px. Рендерит <Outlet/> —
 * App.tsx обязан использовать вложенные <Route> внутри <Route element={<Layout/>}>.
 */
export default function Layout() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-appbg">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-20 pt-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

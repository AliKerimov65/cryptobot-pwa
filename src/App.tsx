import { Routes, Route } from 'react-router';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import AlgoTrading from '@/pages/AlgoTrading';
import Bots from '@/pages/Bots';
import Acta from '@/pages/Acta';
import Bybit from '@/pages/Bybit';
import Settings from '@/pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="algotrading" element={<AlgoTrading />} />
        <Route path="bots" element={<Bots />} />
        <Route path="acta" element={<Acta />} />
        <Route path="bybit" element={<Bybit />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

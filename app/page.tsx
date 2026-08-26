import { StateBidExperience } from './components/statebid-experience';
import { getBoardSnapshot } from '@/lib/server/board';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const initialSnapshot = await getBoardSnapshot();
  return <StateBidExperience initialSnapshot={initialSnapshot} />;
}

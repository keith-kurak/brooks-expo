import { useLocalSearchParams } from 'expo-router';

import { Finder } from '@/screens/finder';

export default function FinderRoute() {
  // `replacing` is an owned pair's id: the Finder was opened to replace it.
  const { replacing } = useLocalSearchParams<{ replacing?: string }>();
  return <Finder replacing={replacing} />;
}

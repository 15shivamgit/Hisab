import { DevToolsScreen } from '@/features/devtools/DevToolsScreen';

// Debug builds only; the screen renders nothing in release builds.
export default function DevToolsRoute() {
  return <DevToolsScreen />;
}

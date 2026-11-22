import ActivityDropdown from './ui/ActivityDropdown.jsx';

export default function NotificationShortcut({ live, onOpen }) {
  return <ActivityDropdown live={live} onOpen={onOpen} />;
}
